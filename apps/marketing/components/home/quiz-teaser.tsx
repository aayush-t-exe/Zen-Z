'use client';

import { useState, type CSSProperties } from 'react';
import { quizTeaser } from '@/lib/content';

const BALL_COLORS = ['#E10600', '#F4C84A', '#0A0908', '#F3EEE3', '#E10600'];
const BALLS_PER_PICK = 3;

/**
 * One real question from the app's quiz (Timeleft's inline quiz + Grail's
 * balls in columns). Picking an answer drops a few balls into its column with
 * a bounce; un-picking empties it. Pure front end: nothing is stored or sent.
 */
export default function QuizTeaser() {
  const [counts, setCounts] = useState<number[]>(() => quizTeaser.options.map(() => 0));
  const picked = counts.some((c) => c > 0);

  const toggle = (i: number) =>
    setCounts((prev) => prev.map((c, k) => (k === i ? (c > 0 ? 0 : BALLS_PER_PICK) : c)));

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <div className="card-sticker bg-paper-3 p-5 sm:p-8">
        <p className="text-sm font-semibold text-paper-muted">A real question from the quiz</p>
        <p className="display-tight mt-2 text-[clamp(1.6rem,4.4vw,2.4rem)]">{quizTeaser.prompt}</p>
        <p className="mt-1 text-[0.9375rem] text-paper-muted">{quizTeaser.hint}</p>
        <ul className="mt-6 grid gap-2.5">
          {quizTeaser.options.map((o, i) => {
            const on = counts[i] > 0;
            return (
              <li key={o.label}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(i)}
                  className={`flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[1rem] font-medium leading-snug transition-[transform,background-color,box-shadow] duration-300 ease-spring active:scale-[0.98] ${
                    on ? 'border-ink bg-white shadow-[0_3px_0_#0A0908]' : 'border-ink/25 hover:border-ink'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 border-ink transition-colors ${on ? 'bg-red text-white' : 'bg-transparent'}`}
                  >
                    {on ? (
                      <svg viewBox="0 0 12 12" className="h-3.5 w-3.5">
                        <path d="M2 6.5 5 9l5-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col">
        {/* The columns: one per answer. */}
        <div className="grid flex-1 grid-cols-5 items-end gap-2 sm:gap-3" aria-hidden>
          {quizTeaser.options.map((o, i) => (
            <div key={o.label} className="flex flex-col items-center">
              <div
                className="relative flex h-40 w-full flex-col-reverse items-center overflow-hidden rounded-b-[1.25rem] rounded-t-md border-2 border-t-0 border-ink/70 bg-white/40 px-1 pb-1.5 sm:h-72"
              >
                {Array.from({ length: counts[i] }).map((_, k) => (
                  <span
                    key={k}
                    className="quiz-ball mb-1 block aspect-square w-[78%] max-w-[3.25rem] rounded-full border-2 border-ink"
                    style={{ background: BALL_COLORS[(i + k) % BALL_COLORS.length], '--k': k } as CSSProperties}
                  />
                ))}
              </div>
              <p className="hand mt-2 text-center text-[1.05rem] leading-[1.05] text-ink sm:text-[1.3rem]">{o.short}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 min-h-[6.5rem]" aria-live="polite">
          {picked ? (
            <div className="quiz-done">
              <p className="display-tight text-[1.6rem] sm:text-[2rem]">That’s one of a few. The rest are in the app.</p>
              <p className="mt-2 text-[0.9375rem] text-paper-muted">Nothing you tapped here was saved or sent anywhere.</p>
            </div>
          ) : (
            <p className="hand text-[1.6rem] text-paper-muted">tap an answer, or a few ↖</p>
          )}
        </div>
      </div>
    </div>
  );
}
