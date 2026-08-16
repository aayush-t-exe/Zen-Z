import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { computeOrderAmountPaise, isTestModeKey, makePaymentLinkReferenceId } from './logic.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { bookingId, redirectUrl } = await req.json();

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

    const slot = booking.slots as any;
    const activity = slot?.activity_types as any;
    const amount = computeOrderAmountPaise(activity?.convenience_fee); // paise

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) {
      return new Response(
        JSON.stringify({ error: 'Payments are not configured yet (missing Razorpay credentials)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isTestMode = isTestModeKey(razorpayKeyId);

    // Payment Links gives us a plain hosted-checkout URL we can open in
    // an in-app browser — no native Razorpay SDK / custom dev client
    // needed, unlike the Orders API + Checkout.js this replaced.
    const linkResponse = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        reference_id: makePaymentLinkReferenceId(crypto.randomUUID()),
        description: `${activity?.name || 'Activity'} — unlock your invitation`,
        notes: {
          booking_id: bookingId,
        },
        // Razorpay rejects callback_url unless it's a real https:// URL
        // — it will not accept the app's own `mobile://`/`exp://` deep
        // link directly. Route through payment-redirect, an https
        // bridge that then hands off to the real deep link, which is
        // what lets WebBrowser.openAuthSessionAsync on the client
        // detect completion and hand control back automatically.
        ...(redirectUrl
          ? {
              callback_url: `${supabaseUrl}/functions/v1/payment-redirect?to=${encodeURIComponent(redirectUrl)}`,
              callback_method: 'get',
            }
          : {}),
      }),
    });

    if (!linkResponse.ok) {
      const errorData = await linkResponse.json().catch(() => ({}));
      console.error('Razorpay error:', errorData);
      return new Response(
        JSON.stringify({
          error: errorData?.error?.description || 'Failed to create payment link',
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const paymentLink = await linkResponse.json();

    // payment_status is intentionally never set here — only the
    // razorpay-webhook function, once Razorpay actually confirms the
    // payment, is allowed to mark a booking paid.
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ payment_id: paymentLink.id })
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
        payment_link_url: paymentLink.short_url,
        amount: amount / 100,
        amount_paise: amount,
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
