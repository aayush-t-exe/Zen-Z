// Pure logic extracted from index.ts so it's testable under Node/Vitest
// without a Deno runtime. crypto.subtle (Web Crypto) is available
// identically under Node 19+ and Deno — no Deno.*/deno.land imports here.

export interface PayuWebhookFields {
  status: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  mihpayid: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  udf6?: string;
  udf7?: string;
  udf8?: string;
  udf9?: string;
  udf10?: string;
  hash: string;
}

// PayU signs its webhook payload with the reverse of the request-hash
// field order, keyed with the merchant salt (the classic Merchant
// Key/Salt pair — not the OAuth Client ID/Secret used to create the
// link, and not the numeric Merchant ID used in the create-request's
// `merchantId` header; these are three separate credential pairs).
//
// CONFIRMED against a real captured webhook from a live ₹1 test
// transaction (2026-08-29): this exact field order/count reproduced
// PayU's real `hash` value byte-for-byte. PayU's public docs only ever
// document a 5-udf version of this formula (udf1-udf5); the real payload
// carries udf1-udf10, and the reverse hash needs all ten — using only 5
// (as an earlier, doc-only version of this function did) computes a
// completely different, wrong hash.
export async function verifySignature(fields: PayuWebhookFields, key: string, salt: string): Promise<boolean> {
  const raw = [
    salt,
    fields.status,
    fields.udf10 || '',
    fields.udf9 || '',
    fields.udf8 || '',
    fields.udf7 || '',
    fields.udf6 || '',
    fields.udf5 || '',
    fields.udf4 || '',
    fields.udf3 || '',
    fields.udf2 || '',
    fields.udf1 || '',
    fields.email,
    fields.firstname,
    fields.productinfo,
    fields.amount,
    fields.txnid,
    key,
  ].join('|');

  const buffer = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(raw));
  const computedHex = Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (computedHex.length !== fields.hash.length) return false;

  // Constant-time comparison — this is a security boundary, not just a
  // string equality check.
  let mismatch = 0;
  for (let i = 0; i < computedHex.length; i++) {
    mismatch |= computedHex.charCodeAt(i) ^ fields.hash.charCodeAt(i);
  }
  return mismatch === 0;
}

// Guards the cancel/payment race: a student can cancel a booking (still
// 'unpaid' at that point, so cancel_unpaid_booking succeeds) while a
// PayU checkout tab from an earlier create-payment-order call is still
// open, then complete payment on that stale tab anyway. Without this
// check, this webhook would blindly flip payment_status to 'paid' on a
// booking that's already 'cancelled' — confirm_group would never see it,
// the student would think they're matched into a slot they cancelled, and
// there'd be no record that PayU actually captured real money.
export function shouldMarkBookingPaid(currentStatus: string | null | undefined): boolean {
  return currentStatus !== 'cancelled';
}

export interface PayuPaidEvent {
  bookingId: string | null;
  paymentId: string | null;
}

// Only a 'success' status ever marks a booking paid. Every other status
// (failure, pending, etc.) is acknowledged with 200 so PayU doesn't
// retry, but otherwise ignored.
//
// CONFIRMED live: PayU mints its own `txnid` internally per attempt —
// it's unrelated to the invoiceNumber create-payment-order sent, so it
// can't be used to find the booking. `udf1` is the only value we control
// that's reliably echoed back, so it's the sole correlation key.
// `mihpayid` is PayU's own permanent transaction identifier (the same
// number shown to the payer on PayU's confirmation page) — the right
// thing to store as the booking's payment_id for our own records/refund
// lookups, replacing the invoiceNumber create-payment-order stored there
// before payment.
export function parsePayuPaidEvent(fields: PayuWebhookFields): PayuPaidEvent | null {
  if (fields.status !== 'success') return null;

  return {
    bookingId: fields.udf1 ?? null,
    paymentId: fields.mihpayid ?? null,
  };
}
