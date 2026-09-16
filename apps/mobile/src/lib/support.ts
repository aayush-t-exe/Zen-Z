import { fetchAppSetting } from '@/lib/app-settings';

export function fetchSupportWhatsappPhone(): Promise<string | null> {
  return fetchAppSetting('support_whatsapp_phone');
}

export function fetchSupportEmail(): Promise<string | null> {
  return fetchAppSetting('support_email');
}

// wa.me wants a bare international number, no '+' or spaces — the stored
// value ('+917069183086', matching emergency_contact_phone's format) needs
// stripping before it goes in the URL.
export function buildWhatsappUrl(phone: string, message: string): string {
  const digitsOnly = phone.replace(/[^\d]/g, '');
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}
