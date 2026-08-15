// Pure logic extracted from index.ts so it's testable under Node/Vitest
// without a Deno runtime — no Deno.*/deno.land imports here.

export function computeOrderAmountPaise(convenienceFee: number | null | undefined): number {
  return (convenienceFee || 21) * 100;
}

export function isTestModeKey(razorpayKeyId: string): boolean {
  return razorpayKeyId.startsWith('rzp_test_');
}
