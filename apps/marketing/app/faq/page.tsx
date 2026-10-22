import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import PageHero from '@/components/pages/page-hero';
import art from '@/assets/art/onboarding-invitation.webp';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Questions students ask about Zen-Z: what it costs, who sits at your table, what groupmates can see, cancelling, refunds and safety.',
  alternates: { canonical: '/faq' },
};

type Qa = { q: string; a: string };

const groups: { title: string; items: Qa[] }[] = [
  {
    title: 'The basics',
    items: [
      {
        q: 'What is Zen-Z?',
        a: 'Zen-Z puts you at a small table with students you haven’t met, for a café, a dinner, a movie or a game. A person on our team builds every group by hand. It’s on Google Play for JNU Jaipur students, and on iPhone through zen-z.site/get-app.',
      },
      {
        q: 'What does it cost?',
        a: 'Cafés and Dinners are free to book; you pay for your own food at the venue. Movies are from ₹126, Box Cricket and Football ₹221, 8-Ball Pool ₹70 and Pickleball ₹129, prepaid, with the payment fees on us. The app shows the final price before you pay. Adding a +1 doubles the price.',
      },
      {
        q: 'How are groups formed?',
        a: 'Our team builds each group by hand, using your personality-quiz answers and relevant account information such as age and gender.',
      },
      {
        q: 'How many people are in a group?',
        a: 'Café, Dinner and Movie groups have 4–5 people. Box Cricket has 10–14, Football 8–14, and 8-Ball Pool and Pickleball exactly 4. A +1 counts as one of those seats.',
      },
    ],
  },
  {
    title: 'Your table',
    items: [
      {
        q: 'When do I see my group and venue?',
        a: 'Your group is shown once matching is done for your slot. The venue and the group chat unlock separately, 48 hours before the meetup, and we remind you 2 hours before.',
      },
      {
        q: 'Can I see another member’s phone number or profile photo?',
        a: 'No. Groupmates see each other’s first name and year of study only. Phone number, profile photo, date of birth, gender and quiz answers are never shown, under any circumstance.',
      },
      {
        q: 'Can I bring a friend who doesn’t have the app?',
        a: 'Yes, with “Bring a +1” when you book. They don’t need an account. The price doubles, you confirm they’re 18+, and you’re responsible for how they behave at the meetup.',
      },
      {
        q: 'Can I leave the group before the event?',
        a: 'No. Leaving the group becomes available after the event.',
      },
      {
        q: 'What if I don’t like my group?',
        a: 'We can’t promise you’ll click with everyone. Not liking your group, on its own, isn’t a reason for a refund.',
      },
    ],
  },
  {
    title: 'Booking and changes',
    items: [
      {
        q: 'Can I cancel a free booking?',
        a: 'Yes, while your table is still being built. Open Your Events and tap “Can’t make it? Give up your seat”, so the seat can go to someone else.',
      },
      {
        q: 'Can I change my activity, date or time after payment?',
        a: 'No. A paid booking can’t be changed. Cancel it under the refund policy and make a new booking.',
      },
      {
        q: 'Can I transfer my booking to someone else?',
        a: 'No. Zen-Z bookings are personal and can’t be transferred.',
      },
      {
        q: 'How does the referral program work?',
        a: 'Share your permanent code from the Invite screen. When a friend’s first paid booking (a Movie or a Sports game) goes through, you get ₹21 off your next Movie or Sports booking, applied automatically. Free Café and Dinner bookings don’t earn a credit or use one.',
      },
      {
        q: 'Do I pay the venue separately?',
        a: 'For what you eat and drink, yes. Café and Dinner bookings are free, and everyone pays for their own order at the venue. Movie tickets and the sports turf or court are in the price you pay us; snacks, drinks and other extras are on you.',
      },
    ],
  },
  {
    title: 'Refunds and safety',
    items: [
      {
        q: 'What happens if Zen-Z can’t form my group?',
        a: 'The slot is cancelled and everyone who paid gets a full refund automatically.',
      },
      {
        q: 'What happens if Zen-Z cancels the event?',
        a: 'You get a full, automatic refund of what you paid.',
      },
      {
        q: 'What if I don’t show up?',
        a: 'A no-show isn’t refunded, because your table was built around your seat. Three no-shows pause new bookings for 7 days.',
      },
      {
        q: 'How do refunds work?',
        a: 'Eligible refunds go back to your original payment method through PayU and usually show up within 5–21 business days, depending on your bank. The Cancellation & Refund Policy has the details.',
      },
      {
        q: 'How do I report someone?',
        a: 'Use the report option in the group chat, any time, even after the event. We look into every report and may take action, and you won’t be put in a group with that person again.',
      },
      {
        q: 'What if I’m in immediate danger?',
        a: 'Contact local emergency services or the police first. Then contact us for anything to do with the platform.',
      },
    ],
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: groups.flatMap((g) =>
    g.items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a },
    }))
  ),
};

export default function FAQPage() {
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHero
        eyebrow="FAQ"
        title={
          <>
            Things people <span className="warm text-red">actually</span> ask.
          </>
        }
        intro={
          <p>
            The questions students ask us most, answered plainly.
            Still stuck? <Link href="/contact" className="font-semibold text-red-deep underline decoration-2 underline-offset-4">Talk to us</Link>.
          </p>
        }
        art={art}
        artAlt="Illustration of an open envelope with a café table rising out of it"
        note="ask us anything"
        updated="October 22, 2026"
      />

      <section className="bg-paper pb-20 sm:pb-28">
        <div className="shell grid gap-14 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <nav aria-label="FAQ topics" className="hidden lg:block">
            <ul className="sticky top-[calc(var(--header-h)+2rem)] grid gap-3">
              {groups.map((g, i) => (
                <li key={g.title}>
                  <a
                    href={`#${slug(g.title)}`}
                    className="pill bg-paper-3 transition-transform duration-300 ease-spring hover:-rotate-2"
                    style={{ rotate: `${i % 2 ? 1.5 : -1.5}deg` }}
                  >
                    {g.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="grid gap-14">
            {groups.map((g) => (
              <section key={g.title} id={slug(g.title)} aria-labelledby={`${slug(g.title)}-h`} className="scroll-mt-28">
                <h2 id={`${slug(g.title)}-h`} className="display-tight text-[1.9rem] sm:text-[2.3rem]">
                  {g.title}
                </h2>
                <div className="mt-5 grid gap-3">
                  {g.items.map((item, i) => (
                    <details
                      key={item.q}
                      data-pop
                      style={{ '--d': i } as CSSProperties}
                      className="faq group rounded-[1.25rem] border-2 border-ink bg-paper-3 shadow-[0_3px_0_#0a0908] open:bg-white/60"
                    >
                      <summary className="flex items-start justify-between gap-4 px-5 py-4 text-[1.0625rem] font-semibold sm:px-6 sm:text-lg">
                        <h3 className="font-sans text-[inherit] font-semibold">{item.q}</h3>
                        <span
                          aria-hidden
                          className="faq-plus mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red text-lg font-bold leading-none text-white"
                        >
                          +
                        </span>
                      </summary>
                      <p className="px-5 pb-5 text-[1.0625rem] leading-relaxed text-paper-muted sm:px-6">{item.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z]+/g, '-');
}
