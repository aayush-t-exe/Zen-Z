// Pure logic extracted from index.ts so it's testable under Node/Vitest
// without a Deno runtime — no Deno.*/deno.land imports here.

// `to` is restricted to known app URI schemes — anything else is rejected,
// so this can't be turned into an open redirect to an arbitrary external
// URL.
export function isAllowedRedirectTarget(to: string | null, allowedSchemes: string[]): to is string {
  return !!to && allowedSchemes.some((scheme) => to.startsWith(scheme));
}

// Forwards every query param Razorpay appended (razorpay_payment_id,
// razorpay_payment_link_status, etc.) except `to` itself onto the deep
// link, so the app can read them once it regains focus.
export function buildDeepLinkTarget(to: string, incomingParams: URLSearchParams): string {
  const deepLink = new URL(to);
  for (const [key, value] of incomingParams) {
    if (key === 'to') continue;
    deepLink.searchParams.set(key, value);
  }
  return deepLink.toString();
}

export function wasPaymentPaid(incomingParams: URLSearchParams): boolean {
  return incomingParams.get('razorpay_payment_link_status') === 'paid';
}
