import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { plans, priceLabel, type Plan } from '@/lib/content';
import { ScribbleArrow } from '@/components/ui/icons';

function Price({ p }: { p: Plan['price'] }) {
  if (p.kind === 'free') {
    return (
      <span className="inline-block rotate-[-6deg] rounded-lg border-2 border-ink bg-red px-2.5 py-1 text-[0.95rem] font-extrabold uppercase tracking-wide text-white shadow-[0_3px_0_#0A0908] [font-family:var(--font-archivo)]">
        Free
      </span>
    );
  }
  return (
    <span className="display-tight text-[1.6rem] sm:text-[1.9rem]">
      {p.kind === 'from' ? <span className="mr-1 text-[0.95rem] font-semibold text-paper-muted [font-family:var(--font-instrument)]">from</span> : null}₹{p.amount}
    </span>
  );
}

export default function Plans() {
  return (
    <section id="plans" className="relative overflow-x-clip bg-paper-2 py-24 sm:py-32">
      <div className="shell">
        <div className="grid items-end gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="hand text-[1.6rem] text-red-deep sm:text-[1.9rem]">pick one</p>
            <h2 className="display mt-2 text-[clamp(2.6rem,8vw,5.2rem)]">
              What are you <span className="warm text-red-deep">up for</span> this week?
            </h2>
          </div>
          <p className="max-w-md text-[1.0625rem] leading-relaxed text-ink/80 lg:justify-self-end">
            Every plan has a fixed time each week. Cafés and Dinners cost nothing to book; you pay for your own food. Movies and games are prepaid, all-in.
          </p>
        </div>

        <ul className="mt-14 grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-7">
          {plans.map((p, i) => (
            <li
              key={p.id}
              data-pop
              className="tilt wobble card-sticker relative flex flex-col bg-paper-3 p-4 sm:p-6"
              style={{ '--tilt': `${p.tilt}deg`, '--d': i % 4, '--pop-r': `${p.tilt * 2}deg` } as CSSProperties}
            >
              <div className="flex items-start justify-between gap-2">
                <Image src={p.icon} alt="" sizes="(min-width: 640px) 96px, 72px" className="sticker h-auto w-[4.5rem] sm:w-24" />
                <Price p={p.price} />
              </div>
              <h3 className="display-tight mt-4 text-[1.35rem] sm:text-[1.75rem]">{p.name}</h3>
              <p className="mt-1 text-[0.875rem] font-semibold text-paper-muted sm:text-[0.9375rem]">
                {p.group}
                {p.length ? ` · ${p.length}` : ''}
              </p>
              <p className="mt-3 text-[0.875rem] leading-snug text-ink/75 sm:text-[0.9375rem]">{p.note}</p>
              <span className="sr-only">Price: {priceLabel(p.price)}</span>
            </li>
          ))}
          <li className="col-span-2 flex flex-col justify-center rounded-[1.5rem] border-2 border-dashed border-ink/30 p-5 sm:p-6 md:col-span-1 lg:col-span-1">
            <p className="hand text-[1.7rem] leading-tight text-ink">
              bringing a friend?
            </p>
            <p className="mt-2 text-[0.9375rem] leading-snug text-ink/80">
              Add a +1 when you book. They sit at your table. It doubles the price, so free stays free.
            </p>
          </li>
        </ul>

        <p className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.9375rem] text-paper-muted">
          <ScribbleArrow className="h-7 w-7 -rotate-90 text-red" d="M8 12c14-2 30 4 40 18m0 0-2-12m2 12-12-2" />
          The app shows the final price before you pay. +1 doubles it.
          <Link href="/pricing" className="font-semibold text-red-deep underline decoration-2 underline-offset-4">
            Full pricing
          </Link>
        </p>
      </div>
    </section>
  );
}
