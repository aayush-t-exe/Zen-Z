import type { Metadata } from 'next';
import LegalLayout from '../../components/legal-layout';

export const metadata: Metadata = {
  title: 'FAQ — Zen-Z',
  description: 'Frequently asked questions about Zen-Z bookings, groups, and refunds.',
};

const faqs: [string, string][] = [
  ['What is Zen-Z?', 'Zen-Z helps people meet new people through organized Café, Dinner, Movie, and Sports sessions.'],
  ['How are groups formed?', 'Our team hand-builds each group using your personality-quiz responses and relevant account information such as age and gender.'],
  ['How many people are in a group?', 'Café, Dinner, and Movie groups have 4–5 people. Box Cricket has 10–14, Football has 8–14, and 8-Ball Pool and Pickleball each have exactly 4. A "+1" companion counts as one of those seats.'],
  ['When do I see my group and venue?', 'Your group is revealed once matching is finalized for your slot. The exact venue and the group chat unlock separately, 48 hours before the meetup.'],
  ['Can I see another member’s phone number or profile photo?', 'No. Group members see name and year of study only. Phone number, profile photo, date of birth, gender, and personality-quiz results are never shown, under any circumstance.'],
  ['Can I leave the group before the event?', 'No. Leaving the group becomes available after the event.'],
  ['Can I change my activity/date/time after payment?', 'No. A paid booking cannot be changed. Cancel under the applicable policy and make a new booking.'],
  ['Can I transfer my booking to someone else?', 'No. Zen-Z bookings are personal and non-transferable.'],
  ['Can I bring a friend who doesn’t have the app?', 'Yes, using "Bring a +1" at booking. They don’t need an account, but the price doubles, you’re responsible for confirming they’re 18+, and you’re responsible for their conduct at the meetup.'],
  ['How does the referral program work?', 'Share your permanent code from the Invite screen. When a friend’s first booking is paid, you earn a ₹21 credit, automatically applied to your next booking — it fully covers a Café/Dinner/Sports-tier booking and discounts a pricier one.'],
  ['What happens if Zen-Z cannot form my group?', 'The slot is cancelled and affected paid users receive an automatic full refund.'],
  ['What happens if Zen-Z cancels the event?', 'You receive a full, automatic refund of the amount paid.'],
  ['Do I pay the venue separately?', 'Yes. Café/Dinner food and drinks, and Sports extras such as food and drinks, are paid individually at the venue. Movie tickets are arranged by Zen-Z.'],
  ['What if I don’t like my group?', 'Compatibility is not guaranteed. Dissatisfaction with a group alone is not a refund reason.'],
  ['How do I report someone?', 'Use the report option in the group chat. Zen-Z investigates and may take action.'],
  ['What if I am in immediate danger?', 'Contact local emergency services or police first, then contact Zen-Z for platform-related support.'],
  ['How do refunds work?', 'Eligible refunds are issued to your original PayU payment method and typically reflect within 5–21 business days, depending on your bank. See the Cancellation & Refund Policy for details.'],
];

export default function FAQPage() {
  return (
    <LegalLayout title="Frequently Asked Questions" updated="September 1, 2026">
      {faqs.map(([q, a]) => (
        <div className="legal-section" key={q}>
          <h2>{q}</h2>
          <p>{a}</p>
        </div>
      ))}
    </LegalLayout>
  );
}
