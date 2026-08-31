import { describe, expect, it } from 'vitest';
import {
  computeOrderAmountRupees,
  isTestModeEnvironment,
  makeInvoiceNumber,
  canCreatePaymentLink,
  shouldReuseExistingLink,
} from './logic';

describe('computeOrderAmountRupees', () => {
  it('passes a convenience fee through unchanged (rupees, not paise)', () => {
    expect(computeOrderAmountRupees(21)).toBe(21);
  });

  it('falls back to ₹21 when the fee is null', () => {
    expect(computeOrderAmountRupees(null)).toBe(21);
  });

  it('falls back to ₹21 when the fee is undefined', () => {
    expect(computeOrderAmountRupees(undefined)).toBe(21);
  });

  it('falls back to ₹21 when the fee is zero (falsy)', () => {
    expect(computeOrderAmountRupees(0)).toBe(21);
  });

  it('doubles the fee when plusOne is true', () => {
    expect(computeOrderAmountRupees(21, true)).toBe(42);
  });

  it('doubles the ₹21 fallback when plusOne is true and the fee is null', () => {
    expect(computeOrderAmountRupees(null, true)).toBe(42);
  });

  it('leaves the fee unchanged when plusOne is false', () => {
    expect(computeOrderAmountRupees(126, false)).toBe(126);
  });
});

describe('isTestModeEnvironment', () => {
  it('recognizes PayU\'s real test-mode hosts', () => {
    expect(isTestModeEnvironment('https://uatoneapi.payu.in')).toBe(true);
  });

  it('recognizes PayU\'s real live-mode hosts', () => {
    expect(isTestModeEnvironment('https://oneapi.payu.in')).toBe(false);
  });
});

describe('makeInvoiceNumber', () => {
  it('strips dashes and truncates a v4 UUID to the 25-char limit', () => {
    const uuid = '11111111-2222-3333-4444-555555555555';
    const ref = makeInvoiceNumber(uuid);
    expect(ref).toHaveLength(25);
    expect(ref).toBe('1111111122223333444455555');
  });

  it('produces distinct references for distinct UUIDs', () => {
    const a = makeInvoiceNumber('11111111-2222-3333-4444-555555555555');
    const b = makeInvoiceNumber('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(a).not.toBe(b);
  });
});

describe('canCreatePaymentLink', () => {
  it('allows creating a link for an unpaid, pending_match booking', () => {
    expect(canCreatePaymentLink('pending_match', 'unpaid')).toBe(true);
  });

  it('refuses a cancelled booking — the other half of the cancel/payment race guard', () => {
    expect(canCreatePaymentLink('cancelled', 'unpaid')).toBe(false);
  });

  it('refuses a booking that is already paid, even if status looks bookable', () => {
    expect(canCreatePaymentLink('pending_match', 'paid')).toBe(false);
  });
});

describe('shouldReuseExistingLink', () => {
  it('reuses a link in the real "active" state confirmed for a fresh, unpaid link', () => {
    expect(shouldReuseExistingLink('active')).toBe(true);
  });

  it('does not reuse when there is no prior link', () => {
    expect(shouldReuseExistingLink(null)).toBe(false);
    expect(shouldReuseExistingLink(undefined)).toBe(false);
  });

  it('does not reuse an unrecognized/unexpected status string', () => {
    expect(shouldReuseExistingLink('cancelled')).toBe(false);
    expect(shouldReuseExistingLink('expired')).toBe(false);
  });
});
