import { describe, expect, it } from 'vitest';
import { verifySignature, parsePayuPaidEvent, shouldMarkBookingPaid, PayuWebhookFields } from './logic';

// Field order confirmed against a real captured webhook from a live ₹1
// PayU test transaction (2026-08-29): salt|status|udf10|...|udf1|email|
// firstname|productinfo|amount|txnid|key, reproducing PayU's real hash
// byte-for-byte. These tests use fake salt/key values (never a real
// production secret in a committed file) but the same field order/count.
async function reverseHashHex(fields: Omit<PayuWebhookFields, 'hash'>, key: string, salt: string): Promise<string> {
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
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const baseFields = {
  status: 'success',
  txnid: 'payu-generated-txn-123', // PayU mints its own, unrelated to anything we send — confirmed live
  amount: '21.00',
  productinfo: 'Cafe unlock',
  firstname: 'Test User',
  email: 'test@example.com',
  mihpayid: '30385182219',
  udf1: 'booking-abc', // the only value we control that's reliably echoed back
};

describe('verifySignature', () => {
  it('accepts a hash computed with the correct key, salt, and 10-field udf order', async () => {
    const hash = await reverseHashHex(baseFields, 'testkey', 'testsalt');
    expect(await verifySignature({ ...baseFields, hash }, 'testkey', 'testsalt')).toBe(true);
  });

  it('rejects a hash computed with the wrong salt', async () => {
    const hash = await reverseHashHex(baseFields, 'testkey', 'wrong-salt');
    expect(await verifySignature({ ...baseFields, hash }, 'testkey', 'testsalt')).toBe(false);
  });

  it('rejects a hash for a tampered field (amount)', async () => {
    const hash = await reverseHashHex(baseFields, 'testkey', 'testsalt');
    const tampered = { ...baseFields, amount: '9999.00', hash };
    expect(await verifySignature(tampered, 'testkey', 'testsalt')).toBe(false);
  });

  it('rejects a hash of the wrong length without throwing', async () => {
    expect(await verifySignature({ ...baseFields, hash: 'short' }, 'testkey', 'testsalt')).toBe(false);
  });

  it('rejects a hash computed with only 5 udf fields instead of the real 10 — regression for the original doc-only guess', async () => {
    // Mirrors the formula this file used before it was corrected against
    // a real captured webhook: salt|status|udf5..udf1|email|firstname|
    // productinfo|amount|txnid|key (only 5 udf slots). PayU's real
    // payload carries 10, so this wrong-but-plausible formula must NOT
    // validate a real hash.
    const wrongRaw = [
      'testsalt',
      baseFields.status,
      '', '', '', '',
      baseFields.udf1,
      baseFields.email,
      baseFields.firstname,
      baseFields.productinfo,
      baseFields.amount,
      baseFields.txnid,
      'testkey',
    ].join('|');
    const buffer = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(wrongRaw));
    const wrongHash = Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(await verifySignature({ ...baseFields, hash: wrongHash }, 'testkey', 'testsalt')).toBe(false);
  });
});

describe('parsePayuPaidEvent', () => {
  it('extracts bookingId from udf1 and paymentId from mihpayid (PayU\'s own txnid is NOT used) on a success status', () => {
    const fields = { ...baseFields, hash: 'irrelevant-here' };
    expect(parsePayuPaidEvent(fields)).toEqual({ bookingId: 'booking-abc', paymentId: '30385182219' });
  });

  it('returns null for any other status', () => {
    const fields = { ...baseFields, status: 'failure', hash: 'irrelevant-here' };
    expect(parsePayuPaidEvent(fields)).toBeNull();
  });

  it('returns a null bookingId when udf1 is missing', () => {
    const fields = { ...baseFields, udf1: undefined, hash: 'irrelevant-here' };
    expect(parsePayuPaidEvent(fields)).toEqual({ bookingId: null, paymentId: '30385182219' });
  });
});

describe('shouldMarkBookingPaid', () => {
  it('allows marking a pending_match booking paid', () => {
    expect(shouldMarkBookingPaid('pending_match')).toBe(true);
  });

  it('allows marking a matched booking paid (late webhook delivery)', () => {
    expect(shouldMarkBookingPaid('matched')).toBe(true);
  });

  it('refuses to mark a cancelled booking paid — the cancel/payment race guard', () => {
    expect(shouldMarkBookingPaid('cancelled')).toBe(false);
  });

  it('allows marking paid when status is missing (defensive default)', () => {
    expect(shouldMarkBookingPaid(null)).toBe(true);
    expect(shouldMarkBookingPaid(undefined)).toBe(true);
  });
});
