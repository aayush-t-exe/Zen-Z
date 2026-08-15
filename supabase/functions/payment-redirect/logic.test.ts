import { describe, expect, it } from 'vitest';
import { isAllowedRedirectTarget, buildDeepLinkTarget, wasPaymentPaid } from './logic';

const ALLOWED_SCHEMES = ['mobile://', 'exp://'];

describe('isAllowedRedirectTarget', () => {
  it('allows a target using an allowed app scheme', () => {
    expect(isAllowedRedirectTarget('mobile://booking/123', ALLOWED_SCHEMES)).toBe(true);
  });

  it('allows a target using the Expo dev-client scheme', () => {
    expect(isAllowedRedirectTarget('exp://192.168.1.5:8081/--/booking', ALLOWED_SCHEMES)).toBe(true);
  });

  it('rejects an arbitrary external https URL (no open redirect)', () => {
    expect(isAllowedRedirectTarget('https://evil.example.com', ALLOWED_SCHEMES)).toBe(false);
  });

  it('rejects a null target', () => {
    expect(isAllowedRedirectTarget(null, ALLOWED_SCHEMES)).toBe(false);
  });

  it('rejects an empty string target', () => {
    expect(isAllowedRedirectTarget('', ALLOWED_SCHEMES)).toBe(false);
  });
});

describe('buildDeepLinkTarget', () => {
  it('forwards Razorpay query params onto the deep link, dropping `to`', () => {
    const params = new URLSearchParams({
      to: 'mobile://booking/123',
      razorpay_payment_id: 'pay_abc',
      razorpay_payment_link_status: 'paid',
    });
    const result = buildDeepLinkTarget('mobile://booking/123', params);
    const resultUrl = new URL(result);
    expect(resultUrl.searchParams.get('to')).toBeNull();
    expect(resultUrl.searchParams.get('razorpay_payment_id')).toBe('pay_abc');
    expect(resultUrl.searchParams.get('razorpay_payment_link_status')).toBe('paid');
  });
});

describe('wasPaymentPaid', () => {
  it('is true when razorpay_payment_link_status is paid', () => {
    expect(wasPaymentPaid(new URLSearchParams({ razorpay_payment_link_status: 'paid' }))).toBe(true);
  });

  it('is false for any other status', () => {
    expect(wasPaymentPaid(new URLSearchParams({ razorpay_payment_link_status: 'cancelled' }))).toBe(false);
  });

  it('is false when the param is missing entirely', () => {
    expect(wasPaymentPaid(new URLSearchParams())).toBe(false);
  });
});
