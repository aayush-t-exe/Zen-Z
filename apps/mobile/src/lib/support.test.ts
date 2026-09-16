import { buildWhatsappUrl } from './support';

// @/lib/supabase throws at import time without real env vars — mocked here
// since this file only exercises buildWhatsappUrl's pure string logic,
// never Supabase itself. See notifications.test.ts for the same pattern.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('buildWhatsappUrl', () => {
  it('strips the leading + and any formatting before building the wa.me link', () => {
    expect(buildWhatsappUrl('+91 70691 83086', 'Hi there')).toBe(
      'https://wa.me/917069183086?text=Hi%20there'
    );
  });

  it('url-encodes the message', () => {
    expect(buildWhatsappUrl('+917069183086', 'Booking id: abc-123 & help?')).toBe(
      'https://wa.me/917069183086?text=Booking%20id%3A%20abc-123%20%26%20help%3F'
    );
  });
});
