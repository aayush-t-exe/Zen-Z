// Pure logic extracted from index.ts so it's testable under Node/Vitest
// without a Deno runtime — no Deno.*/deno.land imports here.

// PayU's Payment Links API takes the amount in plain rupees (e.g. 21, not
// 2100) — confirmed against a real ₹1 live test transaction on
// 2026-08-29 (subAmount: 1 was accepted and echoed back as 1.0), unlike
// Razorpay's paise convention this replaced.
export function computeOrderAmountRupees(convenienceFee: number | null | undefined, plusOne = false): number {
  const base = convenienceFee || 21;
  return plusOne ? base * 2 : base;
}

// The other half of the cancel/payment race guard (see payu-webhook/
// logic.ts's shouldMarkBookingPaid): don't hand out a fresh payable link
// for a booking that's already cancelled (a stale "Finish unlocking your
// spot" tap) or already paid (would create a second live payment link for
// the same booking).
export function canCreatePaymentLink(status: string, paymentStatus: string): boolean {
  return status !== 'cancelled' && paymentStatus !== 'paid';
}

// PayU's OAuth token endpoint and Payment Links API endpoint both have a
// distinct "uat" test host (uat-accounts.payu.in / uatoneapi.payu.in) vs.
// the live host (accounts.payu.in / oneapi.payu.in) — confirmed live
// during the sandbox spike (2026-08-29): both a real test-mode and a real
// live-mode call succeeded against these exact hosts.
export function isTestModeEnvironment(payuApiBaseUrl: string): boolean {
  return payuApiBaseUrl.includes('uat');
}

// PayU requires a unique invoiceNumber per payment-link creation attempt
// (same reasoning Razorpay's reference_id had — see git history for the
// removed makeTransactionReference). Confirmed live: PayU echoes this
// back in the create-response, but it does NOT appear anywhere in the
// webhook payload — the webhook carries PayU's own separately-minted
// txnid instead (also confirmed live, see payu-webhook/logic.ts). So this
// value is only useful for our own "does this booking already have a
// pending link" bookkeeping, never for matching a webhook to a booking.
// [ASSUMPTION, not stress-tested]: PayU's docs never state an exact
// length limit for invoiceNumber; 25 chars is a conservative bet carried
// over from the classic API's txnid limit — the real test only exercised
// a 13-char value, well under this.
const MAX_INVOICE_NUMBER_LENGTH = 25;

export function makeInvoiceNumber(uuid: string): string {
  return uuid.replace(/-/g, '').slice(0, MAX_INVOICE_NUMBER_LENGTH);
}

// Every "Pay"/"Try Again" tap used to mint a brand-new payment link
// unconditionally, even when the booking's last link was still live and
// payable — a student re-opening the payment screen a few times during a
// single checkout attempt could rack up abandoned links for one booking.
// Only a link still in the provider's unpaid/unexpired state is safe to
// hand back as-is.
// [UNVERIFIED — the sandbox spike never exercised this specific request]:
// the create-response for a fresh, unpaid link showed `"status":"active"`
// (confirmed live) — Razorpay's equivalent 'created' string was wrong,
// this replaces it. But the spike never captured what a *paid* or
// *expired* link's status looks like (would need a second GET call after
// payment, not just the webhook), so whether "active" alone is enough to
// distinguish "still payable" from "paid but not yet expired" is not
// confirmed. Re-verify with a real GET-by-invoiceNumber response before
// leaning on this in a way that could double-charge or silently fail to
// offer a fresh link.
export function shouldReuseExistingLink(existingLinkStatus: string | null | undefined): boolean {
  return existingLinkStatus === 'active';
}
