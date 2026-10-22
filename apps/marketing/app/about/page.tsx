import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import PageHero from '@/components/pages/page-hero';
import InfoCard from '@/components/pages/info-card';
import { plans } from '@/lib/content';
import { links } from '@/lib/site';
import art from '@/assets/art/onboarding-gathering.webp';

export const metadata: Metadata = {
  title: 'About',
  description:
    'What Zen-Z is, how a table gets built, what we look after and who runs it. Live on Google Play for JNU Jaipur students since 24 September 2026.',
  alternates: { canonical: '/about' },
};

const howItWorks = [
  'Sign in with a code sent to your email. No password, no phone number, no student ID.',
  'Make a profile with a photo. Only our team sees the photo; it helps us build the right table.',
  'Answer a short personality quiz. We actually read it.',
  'Book: pick an activity, its fixed weekly time, a budget band (skipped for sports), and mixed, women only or men only. Add a +1 if you like. Cafés and Dinners are free; Movies and Sports are paid up front.',
  'A person on our team builds groups of 4–5 (sports groups are bigger) and picks the venue.',
  'You see your groupmates’ first names and years.',
  'The venue and the group chat unlock 48 hours before. We remind you 2 hours before.',
  'Show up. Afterwards, tell us how it went.',
];

export default function AboutPage() {
  return (
    <main>
      <PageHero
        eyebrow="About Zen-Z"
        title={
          <>
            We put you at a <span className="warm text-red">good table.</span>
          </>
        }
        intro={
          <>
            <p>
              Zen-Z is a campus app for meeting people you haven&apos;t met yet, one
              evening at a time. You take a short quiz, pick a plan, and a person on our
              team puts you at a small table with other students. No swiping, no
              browsing profiles, no choosing who to meet.
            </p>
            <p className="mt-4">
              It&apos;s been live on{' '}
              <a href={links.play} className="font-semibold text-ink underline decoration-2 underline-offset-4">
                Google Play
              </a>{' '}
              for JNU Jaipur students since 24 September 2026. On iPhone, it installs from{' '}
              <a href={links.getApp} className="font-semibold text-ink underline decoration-2 underline-offset-4">
                zen-z.site/get-app
              </a>
              .
            </p>
          </>
        }
        art={art}
        artAlt="Illustration of four friends high-fiving across a café table"
        note="one evening at a time"
        updated="October 22, 2026"
      />

      <section aria-labelledby="how-h" className="bg-paper pb-16 sm:pb-24">
        <div className="shell">
          <h2 id="how-h" className="display-tight text-[2rem] sm:text-[2.6rem]">How it works</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((step, i) => (
              <li
                key={i}
                data-pop
                className="card-sticker relative bg-paper-3 p-5 pt-12"
                style={{ '--d': i, rotate: `${i % 2 ? 1 : -1}deg` } as CSSProperties}
              >
                <span
                  aria-hidden
                  className="absolute -top-4 left-5 grid h-11 w-11 place-items-center rounded-full border-2 border-ink bg-red font-display text-lg font-extrabold text-white shadow-[0_3px_0_#0a0908]"
                >
                  {i + 1}
                </span>
                <p className="text-[1.0625rem] leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
          <p className="hand mt-8 text-[1.6rem] text-red-deep">
            Booking for a slot closes at midnight, two days before it.
          </p>
        </div>
      </section>

      <section aria-labelledby="acts-h" className="bg-paper-2 py-16 sm:py-24">
        <div className="shell">
          <h2 id="acts-h" className="display-tight text-[2rem] sm:text-[2.6rem]">What you can book</h2>
          <p className="mt-3 max-w-2xl text-lg text-paper-muted">
            Cafés, Dinners, Movies, Box Cricket, Football, 8-Ball Pool and Pickleball.
            Cafés, Dinners and Movies are always open, never hidden or greyed out, even
            when one of them is our main focus that week.
          </p>
          <ul className="mt-8 flex flex-wrap gap-3">
            {plans.map((p, i) => (
              <li
                key={p.id}
                data-pop
                className="pill bg-paper-3 !py-2 !pl-2 text-base"
                style={{ '--d': i, rotate: `${p.tilt}deg` } as CSSProperties}
              >
                <Image src={p.icon} alt="" width={32} height={32} className="h-8 w-8" />
                {p.name}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[0.9375rem] text-paper-muted">
            Prices for each are on the <Link href="/pricing" className="font-semibold text-red-deep underline decoration-2 underline-offset-4">pricing page</Link>.
          </p>
        </div>
      </section>

      <section aria-label="What we look after" className="bg-paper py-16 sm:py-24">
        <div className="shell grid gap-6 md:grid-cols-2">
          <InfoCard title="How matching works" tilt={-1}>
            <p>
              A person on our team builds each group, using your quiz answers along with
              account details like age and gender. It&apos;s our best effort at a table
              where the odds are good. We can&apos;t promise friendship or chemistry.
            </p>
          </InfoCard>

          <InfoCard title="What we do, and what we don't" tone="butter" tilt={1} delay={1}>
            <p>
              We put the group together and arrange the table, ticket or court. We
              don&apos;t own or run the cafés, restaurants, cinemas or sports venues you
              meet at.
            </p>
          </InfoCard>

          <InfoCard title="What you pay at the venue" tilt={0.5} delay={2}>
            <p>
              Everyone covers their own food, drinks and extras at the venue. What the
              Zen-Z price covers is on the <Link href="/pricing">pricing page</Link>.
            </p>
          </InfoCard>

          <InfoCard title="Private by design" tone="ink" tilt={-0.5} delay={3}>
            <p>
              Your groupmates see your first name and year of study. That&apos;s it.
              Your phone number, photo, date of birth, gender and quiz results are never
              shown to other members, under any circumstance.
            </p>
          </InfoCard>

          <InfoCard title="Bringing a friend, and inviting more" tilt={1} delay={4}>
            <p>
              Don&apos;t want to walk in alone? Add a friend as a +1 on your booking.
              They don&apos;t need the app.
            </p>
            <p>
              You can also invite friends with your own code. When a friend&apos;s first
              paid booking (a Movie or a Sports game) goes through, you get ₹21 off your
              next Movie or Sports booking.
            </p>
          </InfoCard>

          <InfoCard title="Who runs Zen-Z" tone="red" tilt={-1} delay={5}>
            <p>
              Zen-Z is operated by Dhruv Goyal, currently as an individual / unregistered
              project based in Jaipur, India.
            </p>
            <p>
              Questions? <Link href="/contact">Get in touch</Link>.
            </p>
          </InfoCard>
        </div>
      </section>
    </main>
  );
}
