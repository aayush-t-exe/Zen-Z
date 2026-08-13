import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Verifies the raw body against X-Razorpay-Signature before anything
// else touches it — an HMAC over parsed/re-serialized JSON would not
// match Razorpay's own signature, which is computed over the exact
// bytes they sent.
async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const computedHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (computedHex.length !== signature.length) return false;

  // Constant-time comparison — this is a security boundary, not just
  // a string equality check.
  let mismatch = 0;
  for (let i = 0; i < computedHex.length; i++) {
    mismatch |= computedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

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

    // Only payment_link.paid ever marks a booking paid. Every other
    // event type (expired, cancelled, etc.) is acknowledged with 200
    // so Razorpay doesn't retry, but otherwise ignored — there's no
    // 'failed' state in bookings.payment_status to move them into,
    // and an unhandled link just leaves the booking at its default
    // 'unpaid'.
    if (payload.event === 'payment_link.paid') {
      const bookingId = payload.payload?.payment_link?.entity?.reference_id;
      const paymentId = payload.payload?.payment?.entity?.id;

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
