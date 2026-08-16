// Pure logic extracted from index.ts so it's testable under Node/Vitest
// without a Deno runtime. crypto.subtle (Web Crypto) is available
// identically under Node 19+ and Deno — no Deno.*/deno.land imports here.

// Verifies the raw body against X-Razorpay-Signature before anything else
// touches it — an HMAC over parsed/re-serialized JSON would not match
// Razorpay's own signature, which is computed over the exact bytes they
// sent.
export async function verifySignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
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

  // Constant-time comparison — this is a security boundary, not just a
  // string equality check.
  let mismatch = 0;
  for (let i = 0; i < computedHex.length; i++) {
    mismatch |= computedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

export interface PaymentLinkPaidEvent {
  bookingId: string | null;
  paymentId: string | null;
}

// Only payment_link.paid ever marks a booking paid. Every other event type
// (expired, cancelled, etc.) is acknowledged with 200 so Razorpay doesn't
// retry, but otherwise ignored.
//
// bookingId comes from notes.booking_id, not reference_id — reference_id
// is minted fresh per payment attempt (create-payment-order/logic.ts:
// makePaymentLinkReferenceId) so retries don't collide with Razorpay's
// "reference_id already exists" rule, so it's no longer a reliable way
// to recover the booking.
export function parsePaymentLinkPaidEvent(payload: any): PaymentLinkPaidEvent | null {
  if (payload?.event !== 'payment_link.paid') return null;

  return {
    bookingId: payload.payload?.payment_link?.entity?.notes?.booking_id ?? null,
    paymentId: payload.payload?.payment?.entity?.id ?? null,
  };
}
