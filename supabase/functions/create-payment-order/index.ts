import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  computeOrderAmountRupees,
  isTestModeEnvironment,
  makeInvoiceNumber,
  canCreatePaymentLink,
  shouldReuseExistingLink,
} from './logic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// A real sandbox spike (2026-08-29) confirmed PayU's Payment Links
// product never actually calls successUrl/failureUrl — a live ₹1 test
// payment stayed on PayU's own hosted "Payment Completed" page with no
// redirect and no "Continue" button. We still pass a value (harmless,
// and the marketing bridge below is DB-driven rather than trusting
// anything echoed back), but the mobile app's poll-after-browser-closes
// fallback (payment.tsx) is the real, only path back into the app — not
// a fallback for an edge case, the normal case.
const PAYMENT_REDIRECT_URL = 'https://zen-z.site/payment-redirect';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { bookingId } = await req.json();

    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: 'bookingId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Identify the caller from their own JWT — this is the only thing
    // that gates who can create a payment link for a given booking.
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '');

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerData, error: callerError } = await supabase.auth.getUser(jwt);

    if (callerError || !callerData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch booking with slot and activity details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        user_id,
        slot_id,
        status,
        payment_status,
        payment_id,
        plus_one,
        referral_discount_amount,
        movie_choice_type,
        movie:movie_id ( price ),
        slots:slot_id (
          activity_type_id,
          activity_types:activity_type_id (
            name,
            convenience_fee
          )
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (booking.user_id !== callerData.user.id) {
      return new Response(
        JSON.stringify({ error: 'You do not have access to this booking' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!canCreatePaymentLink(booking.status, booking.payment_status)) {
      return new Response(
        JSON.stringify({
          error:
            booking.status === 'cancelled'
              ? 'This booking has been cancelled.'
              : 'This booking has already been paid for.',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const slot = booking.slots as any;
    const activity = slot?.activity_types as any;
    const movie = booking.movie as any;
    // A choose_movie booking is charged against that specific title's own
    // price (a new release can cost more than the usual flat fee, see
    // 0088_movie_price.sql) — surprise_me always pays the flat activity
    // fee since it never learns which movie it'll get until the founder
    // assigns one post-match. This is the actual amount PayU charges, so
    // it must be derived here server-side, never trusted from the client.
    const baseFee =
      booking.movie_choice_type === 'choose_movie' && movie ? movie.price : activity?.convenience_fee;
    const amountRupees = computeOrderAmountRupees(
      baseFee,
      booking.plus_one,
      booking.referral_discount_amount
    );

    // Free bookings are sealed by the seal_free_booking trigger (0101), so
    // reaching here with ₹0 means something upstream is wrong. PayU can't
    // serve a ₹0 link anyway.
    if (amountRupees <= 0) {
      return new Response(
        JSON.stringify({ error: 'Nothing to pay for this booking.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PayU's hosted checkout is a full payment page (unlike Razorpay
    // Payment Links, which needs no cardholder details up front), so it
    // requires the payer's name/email/phone on the create-request itself.
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', booking.user_id)
      .single();
    const customerName = profile?.full_name || 'Student';
    const email = callerData.user.email;
    // profiles.phone is a WhatsApp contact number, not an auth identity
    // (see CLAUDE.md's auth rule) — it's collected at profile creation
    // but PayU requires *some* value in customer.phone regardless, so
    // fall back to a placeholder rather than blocking payment over a
    // field the checkout page itself doesn't strictly need filled in.
    const customerPhone = profile?.phone || '9999999999';

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Your account has no email on file' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payuClientId = Deno.env.get('PAYU_CLIENT_ID');
    const payuClientSecret = Deno.env.get('PAYU_CLIENT_SECRET');
    const payuMerchantId = Deno.env.get('PAYU_MERCHANT_ID');
    const payuOauthTokenUrl = Deno.env.get('PAYU_OAUTH_TOKEN_URL');
    const payuApiBaseUrl = Deno.env.get('PAYU_API_BASE_URL');

    if (!payuClientId || !payuClientSecret || !payuMerchantId || !payuOauthTokenUrl || !payuApiBaseUrl) {
      return new Response(
        JSON.stringify({ error: 'Payments are not configured yet (missing PayU credentials)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isTestMode = isTestModeEnvironment(payuApiBaseUrl);

    // Payment Links uses OAuth2 client-credentials auth (confirmed live)
    // — not the classic merchant key+salt hash create-payment-order used
    // to sign requests with. Nothing in the create-request itself is
    // hash-signed; the bearer token is the only proof of identity PayU
    // wants here.
    const tokenResponse = await fetch(payuOauthTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: payuClientId,
        client_secret: payuClientSecret,
        grant_type: 'client_credentials',
        scope: 'create_payment_links',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('PayU OAuth token error:', await tokenResponse.text().catch(() => ''));
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with PayU' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { access_token: accessToken } = await tokenResponse.json();
    const payuHeaders = {
      merchantId: payuMerchantId,
      Authorization: `Bearer ${accessToken}`,
    };

    // Reuse the booking's last payment link if it's still live, instead of
    // unconditionally minting a new one — see shouldReuseExistingLink's
    // note on why unchecked creation eventually exhausts a provider
    // account-wide cap on live links. [UNVERIFIED, see shouldReuseExistingLink's
    // doc comment] the GET-by-invoiceNumber shape below is not confirmed
    // against a live response.
    if (booking.payment_id) {
      const existingLinkResponse = await fetch(
        `${payuApiBaseUrl}/payment-links/${booking.payment_id}`,
        { headers: payuHeaders }
      );

      if (existingLinkResponse.ok) {
        const existingLink = await existingLinkResponse.json();
        const existingResult = existingLink?.result;
        if (existingResult && shouldReuseExistingLink(existingResult.status)) {
          return new Response(
            JSON.stringify({
              success: true,
              payment_link_url: existingResult.paymentLink,
              amount: amountRupees,
              booking_id: bookingId,
              is_test_mode: isTestMode,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const invoiceNumber = makeInvoiceNumber(crypto.randomUUID());
    const description = `${activity?.name || 'Activity'} — unlock your invitation`;

    // Confirmed live (2026-08-29): amount goes in `subAmount` with
    // `isAmountFilledByCustomer: false` (not a plain `amount` field), and
    // the correlation value we control is `udf.udf1` — PayU's own
    // `invoiceNumber` echo and its own separately-minted `txnid` are not
    // reliably linkable back to this request from the webhook side (see
    // payu-webhook/logic.ts).
    const linkResponse = await fetch(`${payuApiBaseUrl}/payment-links/`, {
      method: 'POST',
      headers: { ...payuHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subAmount: amountRupees,
        isAmountFilledByCustomer: false,
        currency: 'INR',
        description,
        source: 'API',
        customer: {
          name: customerName,
          email,
          phone: customerPhone,
        },
        udf: { udf1: bookingId },
        invoiceNumber,
        successUrl: PAYMENT_REDIRECT_URL,
        failureUrl: PAYMENT_REDIRECT_URL,
      }),
    });

    const linkBody = await linkResponse.json().catch(() => ({}));

    if (!linkResponse.ok || linkBody.status !== 0) {
      console.error('PayU error:', linkBody);
      return new Response(
        JSON.stringify({ error: linkBody?.message || 'Failed to create payment link' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // payment_status is intentionally never set here — only the
    // payu-webhook function, once PayU actually confirms the payment, is
    // allowed to mark a booking paid. payment_id holds our own
    // invoiceNumber for now (needed for the reuse-check above);
    // payu-webhook overwrites it with PayU's real, permanent mihpayid
    // once the payment actually succeeds.
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ payment_id: invoiceNumber })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update booking' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_link_url: linkBody.result.paymentLink,
        amount: amountRupees,
        booking_id: bookingId,
        is_test_mode: isTestMode,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
