import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import PageHero from '@/components/pages/page-hero';
import InfoCard from '@/components/pages/info-card';
import { plans, priceLabel } from '@/lib/content';
import art from '@/assets/art/booking-time-characters.webp';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Cafés and Dinners are free to book. Movies from ₹126, Box Cricket and Football ₹221, 8-Ball Pool ₹70, Pickleball ₹129. One prepaid price, payment fees on us.',
  alternates: { canonical: '/pricing' },
};

export default function PricingPage() {
  return (
    <main>
      <PageHero
        eyebrow="Pricing"
        title={
          <>
            What it costs, <span className="warm text-red">plainly.</span>
          </>
        }
        intro={
          <p>
            Cafés and Dinners are free to book. Movies and sports are one prepaid
            price per person, and we pay the payment fees, not you. The app shows
            the final price before you pay.
          </p>
        }
        art={art}
        artAlt="Illustration of students meeting at a café table and in a park"
        note="no hidden fees"
        updated="October 22, 2026"
      />

      {/* The price cards. */}
      <section aria-labelledby="plans-h" className="bg-paper pb-16 sm:pb-24">
        <div className="shell">
          <h2 id="plans-h" className="display-tight text-[2rem] sm:text-[2.6rem]">
            Every plan, per person
          </h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p, i) => (
              <li
                key={p.id}
                data-pop
                className="wobble card-sticker relative bg-paper-3 p-5"
                style={{ '--tilt': `${p.tilt}deg`, rotate: `${p.tilt}deg`, '--d': i } as CSSProperties}
              >
                {p.price.kind === 'free' ? (
                  <span className="absolute -right-2 -top-3 rotate-6 rounded-full border-2 border-ink bg-red px-3 py-1 text-sm font-extrabold tracking-wide text-white shadow-[0_3px_0_#0a0908]">
                    FREE
                  </span>
                ) : null}
                <Image src={p.icon} alt="" width={72} height={72} className="sticker h-[72px] w-[72px]" />
                <h3 className="display-tight mt-4 text-[1.4rem]">{p.name}</h3>
                <p className="mt-1 text-[1.75rem] font-extrabold leading-none tracking-tight">
                  {p.price.kind === 'free' ? (
                    <span className="text-red-deep">Free to book</span>
                  ) : (
                    priceLabel(p.price)
                  )}
                </p>
                <p className="mt-3 text-[0.9375rem] font-semibold text-paper-muted">
                  {p.group}
                  {p.length ? ` · ${p.length}` : ''}
                </p>
                <p className="mt-1 text-[0.9375rem] text-paper-muted">{p.note}</p>
              </li>
            ))}
            <li
              data-pop
              className="card-sticker flex flex-col justify-center bg-ink p-5 text-fg on-ink"
              style={{ '--d': plans.length, rotate: '1.5deg' } as CSSProperties}
            >
              <p className="hand text-[1.9rem] leading-tight text-butter">+1 doubles it.</p>
              <p className="mt-2 text-[0.9375rem] text-muted">
                Bringing a friend? Their seat is added to yours as one payment.
              </p>
            </li>
          </ul>

          {/* The same prices as a plain table, for anyone who wants them in one place. */}
          <div className="mt-14 max-w-3xl">
            <h2 className="display-tight text-[1.6rem]">The same prices, in one table</h2>
            <div className="mt-4 overflow-x-auto rounded-2xl border-2 border-ink bg-paper-3">
              <table className="w-full min-w-[30rem] border-collapse text-left text-[0.9375rem]">
                <caption className="sr-only">Zen-Z price per person for each activity</caption>
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th scope="col" className="px-4 py-3 font-bold">Activity</th>
                    <th scope="col" className="px-4 py-3 font-bold">Price per person</th>
                    <th scope="col" className="px-4 py-3 font-bold">Group size</th>
                    <th scope="col" className="px-4 py-3 font-bold">Length</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id} className="border-b border-ink/10 last:border-0">
                      <th scope="row" className="px-4 py-3 font-semibold">{p.name}</th>
                      <td className="px-4 py-3">
                        {p.price.kind === 'free' ? 'Free (₹0)' : priceLabel(p.price)}
                      </td>
                      <td className="px-4 py-3">{p.group}</td>
                      <td className="px-4 py-3">{p.length ?? 'Varies'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-paper-muted">
              Prices are per person and can change from time to time. The amount the
              app shows you before you pay is always the price for your booking.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="What the price covers" className="bg-paper-2 py-16 sm:py-24">
        <div className="shell grid gap-6 md:grid-cols-2">
          <InfoCard title="What the price covers" tilt={-1}>
            <p>
              <strong className="text-ink">Cafés and Dinners:</strong> nothing to pay us.
              We build your group and arrange the table for free.
            </p>
            <p>
              <strong className="text-ink">Movies:</strong> the price covers our
              coordination and your movie ticket.
            </p>
            <p>
              <strong className="text-ink">Sports:</strong> the price covers our
              coordination and the turf, court or table booking.
            </p>
          </InfoCard>

          <InfoCard title="What you pay at the venue" tone="butter" tilt={1} delay={1}>
            <p>
              Your own food and drinks at a café or dinner, ordered and paid for by you
              at the venue. Your budget band at booking helps us pick a place that fits.
            </p>
            <p>
              At a movie or a game, anything extra you buy, like snacks or drinks, is on
              you too.
            </p>
          </InfoCard>

          <InfoCard title="Paying" tilt={0.5} delay={2}>
            <p>
              Movies and sports are prepaid, all in. Each booking is its own payment,
              and a failed or pending payment doesn&apos;t hold a seat.
            </p>
            <p>
              Payments go through PayU and are checked on our server. We never store
              card numbers, CVV, UPI or bank login details.
            </p>
          </InfoCard>

          <InfoCard title="Bringing a +1" tilt={-0.5} delay={3}>
            <p>
              Adding a friend to your booking doubles the price shown above, charged as
              one payment. See the <Link href="/terms">Terms</Link> for what bringing a
              +1 involves.
            </p>
          </InfoCard>

          <InfoCard title="Referral credits" tone="ink" tilt={1} delay={4}>
            <p>
              When a friend you invited makes their first paid booking (a Movie or a
              Sports game), you get ₹21 off your next Movie or Sports booking. It&apos;s
              applied automatically.
            </p>
            <p>
              Free Café and Dinner bookings don&apos;t earn a credit and don&apos;t use
              one. Full rules are in the <Link href="/terms#referrals">Terms</Link>.
            </p>
          </InfoCard>

          <InfoCard title="Refunds" tilt={-1} delay={5}>
            <p>
              If we can&apos;t form your group, or we cancel, you get a full refund
              automatically. A no-show isn&apos;t refunded. Everything else is in the{' '}
              <Link href="/refund">Cancellation &amp; Refund Policy</Link>.
            </p>
          </InfoCard>
        </div>
      </section>
    </main>
  );
}
