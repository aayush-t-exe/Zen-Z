// Pure logic extracted from index.ts so it's testable under Node/Vitest
// without a Deno runtime — no Deno.*/deno.land imports here.

export function computeOrderAmountPaise(convenienceFee: number | null | undefined): number {
  return (convenienceFee || 21) * 100;
}

export function isTestModeKey(razorpayKeyId: string): boolean {
  return razorpayKeyId.startsWith('rzp_test_');
}

// Razorpay rejects payment_links.create with a reference_id that's ever
// been used before on the account — even if the earlier link expired or
// was abandoned. Using the bare bookingId meant a second "Try Again"
// after leaving the checkout unpaid always hit
// "payment link with given reference_id ... already exists". A fresh
// v4 UUID per attempt is unique; it doesn't need to encode bookingId at
// all — notes.booking_id (not reference_id) is what the webhook uses to
// find the booking. Guarded against Razorpay's 40-char reference_id
// limit (a bookingId + timestamp suffix tried earlier didn't fit —
// that's the "length must be no more than 40" error).
const MAX_REFERENCE_ID_LENGTH = 40;

export function makePaymentLinkReferenceId(uuid: string): string {
  if (uuid.length > MAX_REFERENCE_ID_LENGTH) {
    throw new Error(`reference_id "${uuid}" exceeds Razorpay's ${MAX_REFERENCE_ID_LENGTH}-char limit`);
  }
  return uuid;
}
