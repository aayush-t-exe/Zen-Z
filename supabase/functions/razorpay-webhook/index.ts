import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifySignature, parsePaymentLinkPaidEvent } from './logic.ts';

serve(async (req) => {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('X-Razorpay-Signature') || '';
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET is not configured');
      return new Response('Webhook not configured', { status: 500 });
    }

    if (!signature || !(await verifySignature(rawBody, signature, webhookSecret))) {
      return new Response('Invalid signature', { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // There's no 'failed' state in bookings.payment_status to move an
    // unhandled event into, and an unhandled link just leaves the booking
    // at its default 'unpaid'.
    const paidEvent = parsePaymentLinkPaidEvent(payload);
    if (paidEvent) {
      const { bookingId, paymentId } = paidEvent;

      if (!bookingId) {
        console.error('payment_link.paid webhook missing reference_id');
        return new Response('Missing reference_id', { status: 400 });
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Naturally idempotent — safe if Razorpay retries delivery.
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
