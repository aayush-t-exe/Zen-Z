import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { buildWhatsappUrl, fetchSupportWhatsappPhone } from '@/lib/support';

// Post-event feedback goes to the founder's WhatsApp, not a public store
// review: someone who had a bad night tells us privately instead of leaving
// a 1-star rating. The booking id comes first so the typing cursor lands at
// the end of the greeting.
export async function openFeedbackOnWhatsapp(bookingId: string | null): Promise<void> {
  try {
    const phone = await fetchSupportWhatsappPhone();
    if (!phone) {
      router.push('/(home)/bookings');
      return;
    }
    const message = `${bookingId ? `Booking ID: ${bookingId}\n\n` : ''}Hi, here's how my Zen-Z meetup went: `;
    await Linking.openURL(buildWhatsappUrl(phone, message));
  } catch (err) {
    console.error('Failed to open feedback on WhatsApp:', err);
    router.push('/(home)/bookings');
  }
}
