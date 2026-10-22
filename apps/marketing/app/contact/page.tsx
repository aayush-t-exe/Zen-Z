import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import PageHero from '@/components/pages/page-hero';
import InfoCard from '@/components/pages/info-card';
import { InstagramIcon } from '@/components/ui/icons';
import { links, operator } from '@/lib/site';
import art from '@/assets/art/home-banner-people.webp';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Reach Zen-Z for help with a booking, a payment, a refund, your account or a safety concern. Email, phone or Instagram, any time.',
  alternates: { canonical: '/contact' },
};

const ways = [
  {
    label: 'Email',
    value: operator.email,
    href: `mailto:${operator.email}`,
    tone: 'bg-red text-white',
  },
  {
    label: 'Phone',
    value: operator.phones[0],
    href: `tel:+91${operator.phones[0]}`,
    tone: 'bg-paper-3 text-ink',
  },
  {
    label: 'Phone',
    value: operator.phones[1],
    href: `tel:+91${operator.phones[1]}`,
    tone: 'bg-butter text-ink',
  },
];

export default function ContactPage() {
  return (
    <main>
      <PageHero
        eyebrow="Contact"
        title={
          <>
            Talk to a <span className="warm text-red">person.</span>
          </>
        }
        intro={
          <p>
            Need help with a booking, a payment, a refund, your account or something
            that didn&apos;t feel right? Reach us here. We&apos;re around 24×7 and aim
            to reply within 24 hours.
          </p>
        }
        art={art}
        artAlt="Illustration of two students shaking hands and waving"
        note="we reply, promise"
        updated="October 22, 2026"
      />

      <section aria-labelledby="reach-h" className="bg-paper pb-16 sm:pb-24">
        <div className="shell">
          <h2 id="reach-h" className="display-tight text-[2rem] sm:text-[2.6rem]">Support</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ways.map((w, i) => (
              <li key={w.value} data-pop style={{ '--d': i } as CSSProperties}>
                <a
                  href={w.href}
                  className={`wobble card-sticker block p-5 ${w.tone}`}
                  style={{ '--tilt': `${i % 2 ? 1.5 : -1.5}deg`, rotate: `${i % 2 ? 1.5 : -1.5}deg` } as CSSProperties}
                >
                  <span className="text-sm font-bold uppercase tracking-[0.06em]">{w.label}</span>
                  <span className="mt-2 block break-all font-display text-[1.3rem] font-extrabold leading-tight">
                    {w.value}
                  </span>
                </a>
              </li>
            ))}
            <li data-pop style={{ '--d': 3 } as CSSProperties}>
              <a
                href={links.instagram}
                className="wobble card-sticker on-ink block bg-ink p-5 text-fg"
                style={{ '--tilt': '1deg', rotate: '1deg' } as CSSProperties}
              >
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.06em] text-muted">
                  <InstagramIcon className="h-4 w-4" /> Instagram
                </span>
                <span className="mt-2 block font-display text-[1.3rem] font-extrabold leading-tight">
                  {links.instagramHandle}
                </span>
              </a>
            </li>
          </ul>
          <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-[1.0625rem]">
            <div className="flex gap-2">
              <dt className="font-semibold">Availability:</dt>
              <dd className="text-paper-muted">24×7</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-semibold">Typical response target:</dt>
              <dd className="text-paper-muted">within 24 hours</dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-label="Refunds, address and emergencies" className="bg-paper-2 py-16 sm:py-24">
        <div className="shell grid gap-6 md:grid-cols-2">
          <InfoCard title="Refund requests" tilt={-1}>
            <p>
              Email paid-booking refund requests to{' '}
              <a href={`mailto:${operator.email}`}>{operator.email}</a> before the
              cancellation cutoff. Include your full name, registered email, booking ID,
              activity, scheduled date and why you&apos;re cancelling.
            </p>
            <p>
              Who gets a refund, and when, is in the{' '}
              <Link href="/refund">Cancellation &amp; Refund Policy</Link>.
            </p>
          </InfoCard>

          <InfoCard title="Address" tone="butter" tilt={1} delay={1}>
            <address className="not-italic">
              Zen-Z
              <br />
              Operated by {operator.name}
              <br />
              A-21, Anand Vihar, Railway Colony,
              <br />
              Jagatpura, Jaipur, Rajasthan – 302017,
              <br />
              India
            </address>
          </InfoCard>

          <InfoCard title="In an emergency" tone="red" tilt={0.5} delay={2} className="md:col-span-2">
            <p>
              If you&apos;re in immediate danger, contact local emergency services or the
              police first. Then contact us for platform support or to report someone.
            </p>
          </InfoCard>
        </div>
      </section>
    </main>
  );
}
