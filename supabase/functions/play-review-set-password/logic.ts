// Pure logic extracted from index.ts so it's testable under Node/Vitest
// without a Deno runtime — no Deno.*/deno.land imports here.

// Not timing-safe — deliberately so: same reasoning as
// play-review-code/logic.ts, this gates a single fixed, low-value
// review account, not a real auth boundary.
export function isAuthorized(providedSecret: string | null, expectedSecret: string | undefined): boolean {
  return Boolean(expectedSecret) && providedSecret === expectedSecret;
}

// The review account's password is typed into the app's existing 6-digit
// OTP box UI, so it has to actually fit — enforce the same shape here
// rather than silently accepting something the app can never collect.
export function isValidReviewPassword(password: string | null): password is string {
  return Boolean(password) && /^\d{6}$/.test(password as string);
}
