import type { StaticImageData } from 'next/image';
import type { CSSProperties } from 'react';
import { quizTeaser, steps } from '@/lib/content';
import { ScribbleArrow, ScribbleUnderline } from '@/components/ui/icons';
import NearImage from '@/components/ui/near-image';
import DrawLine from './draw-line';
import invitation from '@/assets/art/onboarding-invitation.webp';
import hands from '@/assets/art/onboarding-hands.webp';
import timeArt from '@/assets/art/booking-time-art.webp';
import gathering from '@/assets/art/onboarding-gathering.webp';

const art: (StaticImageData | null)[] = [invitation, null, hands, timeArt, gathering];

/** Step 2's picture: a little card of the real quiz question, doodled. */
function QuizDoodle() {
  return (
    <div className="card-sticker mx-auto w-full max-w-[22rem] rotate-[-3deg] bg-paper-3 p-5">
      <p className="text-xs font-semibold text-paper-muted">Question 3 of 7</p>
      <p className="display-tight mt-2 text-[1.35rem]">{quizTeaser.prompt}</p>
      <ul className="mt-4 grid gap-2 text-[0.9375rem] font-medium">
        {quizTeaser.options.slice(0, 3).map((o, i) => (
          <li key={o.label} className={`flex items-start gap-2.5 rounded-xl border-2 px-3 py-2 ${i !== 1 ? 'border-ink bg-white' : 'border-ink/20'}`}>
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 border-ink ${i !== 1 ? 'bg-red text-white' : ''}`} aria-hidden>
              {i !== 1 ? (
                <svg viewBox="0 0 12 12" className="h-3 w-3">
                  <path d="M2 6.5 5 9l5-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </span>
            {o.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section id="how" className="cv relative bg-paper py-24 sm:py-32">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="hand text-[1.6rem] text-red-deep sm:text-[1.9rem]">here’s the whole thing</p>
          <h2 className="display mt-2 text-[clamp(2.6rem,8vw,5.2rem)]">
            Five steps.{' '}
            <span className="relative inline-block">
              <span className="warm text-red-deep">The last one</span>
              <ScribbleUnderline className="absolute -bottom-2 left-0 h-3 w-full text-red" />
            </span>{' '}
            is showing up.
          </h2>
        </div>

        <DrawLine className="mt-16 sm:mt-24">
          <ol className="relative grid gap-16 sm:gap-24 lg:gap-28">
            {steps.map((s, i) => {
              const flip = i % 2 === 1;
              const pic = art[i];
              return (
                <li key={s.title} className="relative grid items-center gap-8 pl-10 lg:grid-cols-2 lg:gap-24 lg:pl-0">
                  <span
                    data-anchor
                    aria-hidden
                    className="absolute left-0 top-2 z-10 h-5 w-5 rounded-full border-[3px] border-ink bg-red lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2"
                  />
                  <div data-pop className={`relative ${flip ? 'lg:order-2' : ''}`} style={{ '--pop-r': flip ? '3deg' : '-3deg' } as CSSProperties}>
                    {pic ? (
                      <NearImage
                        src={pic}
                        alt=""
                        sizes="(min-width: 1024px) 400px, 80vw"
                        className={`sticker mx-auto h-auto w-full max-w-[19rem] sm:max-w-[23rem] ${flip ? 'rotate-[3deg]' : 'rotate-[-2deg]'}`}
                      />
                    ) : (
                      <QuizDoodle />
                    )}
                  </div>
                  <div data-pop className={`relative ${flip ? 'lg:order-1 lg:text-right' : ''}`} style={{ '--d': 2 } as CSSProperties}>
                    <p className="hand text-[2.6rem] leading-none text-red">{i + 1}.</p>
                    <h3 className="display-tight mt-1 text-[clamp(1.9rem,4.6vw,2.9rem)]">{s.title}</h3>
                    <p className={`mt-3 max-w-md text-[1.0625rem] leading-relaxed text-ink/80 sm:text-[1.125rem] ${flip ? 'lg:ml-auto' : ''}`}>{s.body}</p>
                    <p className={`hand mt-4 inline-flex items-center gap-2 text-[1.45rem] text-paper-muted ${flip ? 'lg:flex-row-reverse' : ''}`}>
                      <ScribbleArrow className={`h-8 w-8 text-red ${flip ? 'lg:-scale-x-100' : ''}`} d="M8 12c14-2 30 4 40 18m0 0-2-12m2 12-12-2" />
                      {s.note}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </DrawLine>
      </div>
    </section>
  );
}
