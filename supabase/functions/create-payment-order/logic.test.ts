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
  it('embeds the bookingId and timestamp', () => {
    expect(makePaymentLinkReferenceId('booking-123', 1700000000000)).toBe('booking-123-1700000000000');
  });

  it('produces a different id for the same booking at a different timestamp', () => {
    const first = makePaymentLinkReferenceId('booking-123', 1700000000000);
    const second = makePaymentLinkReferenceId('booking-123', 1700000000001);
    expect(first).not.toBe(second);
  });
});
