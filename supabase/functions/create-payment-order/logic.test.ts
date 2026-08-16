import { describe, expect, it } from 'vitest';
import { computeOrderAmountPaise, isTestModeKey, makePaymentLinkReferenceId } from './logic';

describe('computeOrderAmountPaise', () => {
  it('converts a convenience fee in rupees to paise', () => {
    expect(computeOrderAmountPaise(21)).toBe(2100);
  });

  it('falls back to ₹21 when the fee is null', () => {
    expect(computeOrderAmountPaise(null)).toBe(2100);
  });

  it('falls back to ₹21 when the fee is undefined', () => {
    expect(computeOrderAmountPaise(undefined)).toBe(2100);
  });

  it('falls back to ₹21 when the fee is zero (falsy)', () => {
    expect(computeOrderAmountPaise(0)).toBe(2100);
  });
});

describe('isTestModeKey', () => {
  it('recognizes a Razorpay test-mode key', () => {
    expect(isTestModeKey('rzp_test_abc123')).toBe(true);
  });

  it('recognizes a Razorpay live-mode key', () => {
    expect(isTestModeKey('rzp_live_abc123')).toBe(false);
  });
});

describe('makePaymentLinkReferenceId', () => {
  it('passes through an id within Razorpay\'s 40-char limit', () => {
    const uuid = '11111111-2222-3333-4444-555555555555';
    expect(uuid.length).toBeLessThanOrEqual(40);
    expect(makePaymentLinkReferenceId(uuid)).toBe(uuid);
  });

  it('throws instead of silently sending an over-length reference_id to Razorpay', () => {
    const tooLong = 'a'.repeat(41);
    expect(() => makePaymentLinkReferenceId(tooLong)).toThrow(/exceeds/);
  });
});
