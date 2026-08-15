import { describe, expect, it } from 'vitest';
import { verifySignature, parsePaymentLinkPaidEvent } from './logic';

async function hmacHex(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('verifySignature', () => {
  it('accepts a signature computed with the correct secret', async () => {
    const rawBody = JSON.stringify({ event: 'payment_link.paid' });
    const signature = await hmacHex(rawBody, 'webhook-secret');
    expect(await verifySignature(rawBody, signature, 'webhook-secret')).toBe(true);
  });

  it('rejects a signature computed with the wrong secret', async () => {
    const rawBody = JSON.stringify({ event: 'payment_link.paid' });
    const signature = await hmacHex(rawBody, 'wrong-secret');
    expect(await verifySignature(rawBody, signature, 'webhook-secret')).toBe(false);
  });

  it('rejects a signature for a tampered body', async () => {
    const signature = await hmacHex(JSON.stringify({ event: 'payment_link.paid' }), 'webhook-secret');
    const tamperedBody = JSON.stringify({ event: 'payment_link.paid', amount: 999999 });
    expect(await verifySignature(tamperedBody, signature, 'webhook-secret')).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', async () => {
    expect(await verifySignature('body', 'short', 'secret')).toBe(false);
  });
});

describe('parsePaymentLinkPaidEvent', () => {
  it('extracts bookingId and paymentId from a payment_link.paid event', () => {
    const payload = {
      event: 'payment_link.paid',
      payload: {
        payment_link: { entity: { reference_id: 'booking-123' } },
        payment: { entity: { id: 'pay_456' } },
      },
    };
    expect(parsePaymentLinkPaidEvent(payload)).toEqual({ bookingId: 'booking-123', paymentId: 'pay_456' });
  });

  it('returns null for any other event type', () => {
    const payload = { event: 'payment_link.expired', payload: {} };
    expect(parsePaymentLinkPaidEvent(payload)).toBeNull();
  });

  it('returns a null bookingId when reference_id is missing', () => {
    const payload = { event: 'payment_link.paid', payload: { payment_link: { entity: {} } } };
    expect(parsePaymentLinkPaidEvent(payload)).toEqual({ bookingId: null, paymentId: null });
  });
});
