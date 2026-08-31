import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifySignature, parsePayuPaidEvent, shouldMarkBookingPaid, PayuWebhookFields } from './logic.ts';

// CONFIRMED live (2026-08-29): PayU's Payment Links webhook POSTs
// form-encoded fields (`content-type: application/x-www-form-urlencoded`),
// not JSON like Razorpay's webhook did. The JSON branch below is kept as
// a defensive fallback only — every real delivery observed so far was
// form-encoded.
function parseWebhookFields(rawBody: string, contentType: string): PayuWebhookFields {
  if (contentType.includes('application/json')) {
    return JSON.parse(rawBody);
  }

  const params = new URLSearchParams(rawBody);
  const fields: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    fields[key] = value;
  }
  return fields as unknown as PayuWebhookFields;
}

serve(async (req) => {
  try {
    const rawBody = await req.text();
    const contentType = req.headers.get('Content-Type') || '';
    const payuMerchantKey = Deno.env.get('PAYU_MERCHANT_KEY');
    const payuMerchantSalt = Deno.env.get('PAYU_MERCHANT_SALT');

    if (!payuMerchantKey || !payuMerchantSalt) {
      console.error('PAYU_MERCHANT_KEY/PAYU_MERCHANT_SALT is not configured');
      return new Response('Webhook not configured', { status: 500 });
    }

    const fields = parseWebhookFields(rawBody, contentType);

    if (!fields?.hash || !(await verifySignature(fields, payuMerchantKey, payuMerchantSalt))) {
      return new Response('Invalid signature', { status: 401 });
    }

    // There's no 'failed' state in bookings.payment_status to move an
    // unhandled event into, and an unhandled/failed transaction just
    // leaves the booking at its default 'unpaid'.
    const paidEvent = parsePayuPaidEvent(fields);
    if (paidEvent) {
      const { bookingId, paymentId } = paidEvent;

      if (!bookingId) {
        console.error('PayU success webhook missing udf1 (booking id)');
        return new Response('Missing udf1', { status: 400 });
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: existingBooking, error: fetchError } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .single();

      if (fetchError || !existingBooking) {
        console.error(`PayU success webhook: booking ${bookingId} not found`, fetchError);
        return new Response('Booking not found', { status: 404 });
      }

      if (!shouldMarkBookingPaid(existingBooking.status)) {
        // Real money was captured by PayU for a booking that's no longer
        // valid on our side. There's no 'refund_pending' state in
        // payment_status and no alerting/Sentry wired up yet, so a loud
        // function-log line is the only channel available right now —
        // the founder needs to manually refund payment ${paymentId} via
        // the PayU dashboard. Return 200 so PayU doesn't retry delivery
        // of an event we've fully and deliberately handled.
        console.error(
          `PAYMENT RACE: booking ${bookingId} was cancelled before its PayU success webhook arrived — ` +
            `PayU payment ${paymentId} was captured and needs a MANUAL REFUND. Booking was NOT marked paid.`
        );
        return new Response('Booking already cancelled — payment needs manual refund', { status: 200 });
      }

      // Naturally idempotent — safe if PayU retries delivery.
      const { error } = await supabase
        .from('bookings')
        .update({ payment_status: 'paid', payment_id: paymentId })
        .eq('id', bookingId);

      if (error) {
        console.error('Failed to mark booking paid:', error);
        return new Response('Failed to update booking', { status: 500 });
      }
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal error', { status: 500 });
  }
});
