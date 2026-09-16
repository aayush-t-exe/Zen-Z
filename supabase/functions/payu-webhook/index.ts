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

// 2026-09-16: a real paid booking got stuck at payment_status='unpaid'
// with nothing anywhere to say whether PayU ever actually called this
// function. Every invocation is now logged (payment_webhook_events,
// 0097), regardless of outcome, so the next stuck payment is a query
// away instead of a guess. Best-effort and never allowed to affect the
// response PayU gets back — a logging failure must not turn a real
// success into a dropped webhook delivery.
async function logWebhookEvent(
  supabase: ReturnType<typeof createClient>,
  event: {
    rawBody: string;
    signatureValid: boolean;
    bookingId?: string | null;
    payuStatus?: string | null;
    txnid?: string | null;
    mihpayid?: string | null;
    outcome: string;
  }
) {
  try {
    await supabase.from('payment_webhook_events').insert({
      raw_body: event.rawBody,
      signature_valid: event.signatureValid,
      booking_id: event.bookingId ?? null,
      payu_status: event.payuStatus ?? null,
      txnid: event.txnid ?? null,
      mihpayid: event.mihpayid ?? null,
      outcome: event.outcome,
    });
  } catch (logError) {
    console.error('Failed to log webhook event (non-fatal):', logError);
  }
}

serve(async (req) => {
  const rawBody = await req.text();

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    return new Response('Internal error', { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const contentType = req.headers.get('Content-Type') || '';
    const payuMerchantKey = Deno.env.get('PAYU_MERCHANT_KEY');
    const payuMerchantSalt = Deno.env.get('PAYU_MERCHANT_SALT');

    if (!payuMerchantKey || !payuMerchantSalt) {
      console.error('PAYU_MERCHANT_KEY/PAYU_MERCHANT_SALT is not configured');
      await logWebhookEvent(supabase, { rawBody, signatureValid: false, outcome: 'webhook_not_configured' });
      return new Response('Webhook not configured', { status: 500 });
    }

    const fields = parseWebhookFields(rawBody, contentType);
    const signatureValid = !!fields?.hash && (await verifySignature(fields, payuMerchantKey, payuMerchantSalt));

    if (!signatureValid) {
      await logWebhookEvent(supabase, {
        rawBody,
        signatureValid: false,
        bookingId: fields?.udf1 ?? null,
        payuStatus: fields?.status ?? null,
        txnid: fields?.txnid ?? null,
        mihpayid: fields?.mihpayid ?? null,
        outcome: 'invalid_signature',
      });
      return new Response('Invalid signature', { status: 401 });
    }

    // There's no 'failed' state in bookings.payment_status to move an
    // unhandled event into, and an unhandled/failed transaction just
    // leaves the booking at its default 'unpaid'.
    const paidEvent = parsePayuPaidEvent(fields);
    if (!paidEvent) {
      await logWebhookEvent(supabase, {
        rawBody,
        signatureValid: true,
        bookingId: fields.udf1 ?? null,
        payuStatus: fields.status ?? null,
        txnid: fields.txnid ?? null,
        mihpayid: fields.mihpayid ?? null,
        outcome: 'ignored_non_success_status',
      });
      return new Response('ok', { status: 200 });
    }

    const { bookingId, paymentId } = paidEvent;

    if (!bookingId) {
      console.error('PayU success webhook missing udf1 (booking id)');
      await logWebhookEvent(supabase, {
        rawBody,
        signatureValid: true,
        payuStatus: fields.status,
        txnid: fields.txnid,
        mihpayid: fields.mihpayid,
        outcome: 'missing_udf1',
      });
      return new Response('Missing udf1', { status: 400 });
    }

    const { data: existingBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .single();

    if (fetchError || !existingBooking) {
      console.error(`PayU success webhook: booking ${bookingId} not found`, fetchError);
      await logWebhookEvent(supabase, {
        rawBody,
        signatureValid: true,
        bookingId,
        payuStatus: fields.status,
        txnid: fields.txnid,
        mihpayid: fields.mihpayid,
        outcome: 'booking_not_found',
      });
      return new Response('Booking not found', { status: 404 });
    }

    if (!shouldMarkBookingPaid(existingBooking.status)) {
      // Real money was captured by PayU for a booking that's no longer
      // valid on our side. There's no 'refund_pending' state in
      // payment_status, so the founder needs to manually refund payment
      // ${paymentId} via the PayU dashboard — this event log entry (outcome
      // 'payment_race_manual_refund_needed') is the durable record of
      // that, alongside the loud function-log line. Return 200 so PayU
      // doesn't retry delivery of an event we've fully and deliberately
      // handled.
      console.error(
        `PAYMENT RACE: booking ${bookingId} was cancelled before its PayU success webhook arrived — ` +
          `PayU payment ${paymentId} was captured and needs a MANUAL REFUND. Booking was NOT marked paid.`
      );
      await logWebhookEvent(supabase, {
        rawBody,
        signatureValid: true,
        bookingId,
        payuStatus: fields.status,
        txnid: fields.txnid,
        mihpayid: fields.mihpayid,
        outcome: 'payment_race_manual_refund_needed',
      });
      return new Response('Booking already cancelled — payment needs manual refund', { status: 200 });
    }

    // Naturally idempotent — safe if PayU retries delivery.
    const { error } = await supabase
      .from('bookings')
      .update({ payment_status: 'paid', payment_id: paymentId })
      .eq('id', bookingId);

    if (error) {
      console.error('Failed to mark booking paid:', error);
      await logWebhookEvent(supabase, {
        rawBody,
        signatureValid: true,
        bookingId,
        payuStatus: fields.status,
        txnid: fields.txnid,
        mihpayid: fields.mihpayid,
        outcome: 'update_failed',
      });
      return new Response('Failed to update booking', { status: 500 });
    }

    await logWebhookEvent(supabase, {
      rawBody,
      signatureValid: true,
      bookingId,
      payuStatus: fields.status,
      txnid: fields.txnid,
      mihpayid: fields.mihpayid,
      outcome: 'marked_paid',
    });

    return new Response('ok', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    await logWebhookEvent(supabase, {
      rawBody,
      signatureValid: false,
      outcome: `error: ${error instanceof Error ? error.message : String(error)}`,
    });
    return new Response('Internal error', { status: 500 });
  }
});
