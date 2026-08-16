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
// "payment link with given reference_id ... already exists". Mint a
// fresh one per attempt instead; notes.booking_id (not reference_id) is
// what the webhook uses to find the booking, so this doesn't affect that.
export function makePaymentLinkReferenceId(bookingId: string, timestamp: number): string {
  return `${bookingId}-${timestamp}`;
}
