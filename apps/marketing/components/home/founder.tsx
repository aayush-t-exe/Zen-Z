import Image from 'next/image';
import portrait from '@/assets/founder/portrait.jpg';
import { links, tablesPerWeek } from '@/lib/site';
import { ScribbleCircle } from '@/components/ui/icons';

/**
 * Who builds your table. The constitution's trust centrepiece: a woman at JNU
 * should be able to see that the people running this are safe and serious.
 * Aayush started Zen-Z; the team reads the answers and builds the tables, so
 * the copy says "I" for the first and "we" for the rest. The weekly number
 * only appears once confirmed (lib/site.ts → tablesPerWeek).
 */
export default function Founder() {
  return (
    <section aria-labelledby="founder-title" className="cv relative bg-paper-2 py-24 sm:py-32">
      <div className="shell grid items-center gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        {/* A taped polaroid. */}
        <figure data-pop className="relative mx-auto w-full max-w-[22rem] lg:max-w-[26rem]" style={{ ['--pop-r' as string]: '4deg' }}>
          <div className="relative rotate-[-3deg] bg-white p-3 pb-14 shadow-[0_24px_50px_-20px_rgb(40_20_10/0.45)]">
            <Image
              src={portrait}
              alt="Aayush, who started Zen-Z, smiling outdoors in a blue shirt."
              sizes="(min-width: 1024px) 400px, 85vw"
              placeholder="blur"
              className="aspect-[4/5] h-auto w-full object-cover [filter:saturate(0.9)_contrast(1.04)_sepia(0.08)]"
            />
            <figcaption className="hand absolute inset-x-0 bottom-3 text-center text-[1.6rem] text-ink">
              Aayush, started Zen-Z
            </figcaption>
          </div>
          <span aria-hidden className="absolute -top-3 left-1/2 h-8 w-28 -translate-x-1/2 rotate-[4deg] bg-butter/80 shadow-sm" />
        </figure>

        <div>
          <p className="hand text-[1.6rem] text-red-deep sm:text-[1.9rem]">who builds your table</p>
          <h2 id="founder-title" className="display mt-2 text-[clamp(2.4rem,7vw,4.6rem)]">
            Hi, I’m Aayush. We read the{' '}
            <span className="relative inline-block whitespace-nowrap">
              <span className="warm text-red-deep">answers.</span>
              <ScribbleCircle className="absolute -inset-x-3 -inset-y-2 h-[calc(100%+1rem)] w-[calc(100%+1.5rem)] text-red" />
            </span>
          </h2>
          <div className="mt-7 grid max-w-xl gap-4 text-[1.0625rem] leading-relaxed text-ink/85 sm:text-[1.125rem]">
            <p>
              I started Zen-Z at JNU because nothing much happens here, and I wanted something to. Now our team reads your quiz
              answers and puts every table together by hand. That’s why there are{' '}
              {tablesPerWeek ? <>only about {tablesPerWeek} tables a week.</> : <>only so many tables each week.</>}
            </p>
            <p>
              Your photo is seen by our team and nobody else. Not the people at your table, not anyone in the app. The people you
              meet see your first name and your year.
            </p>
            <p>
              If something feels off, before or after, tell us. We’d much rather hear it from you.
            </p>
          </div>
          <p className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[0.9375rem] font-semibold">
            <a href={links.instagramDm} className="text-red-deep underline decoration-2 underline-offset-4">
              Message us on Instagram
            </a>
            <a href={`mailto:${links.email}`} className="text-red-deep underline decoration-2 underline-offset-4">
              {links.email}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
