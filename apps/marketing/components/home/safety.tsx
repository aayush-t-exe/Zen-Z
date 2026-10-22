import type { CSSProperties, ReactNode } from 'react';
import { safety } from '@/lib/content';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

// One doodle per card, in the order of lib/content.ts `safety`.
const icons: ReactNode[] = [
  <svg key="photo" viewBox="0 0 32 32" {...stroke}><rect x="4" y="9" width="24" height="17" rx="4" /><circle cx="16" cy="17.5" r="4.5" /><path d="M11 9l2-3h6l2 3M4 4l24 24" /></svg>,
  <svg key="women" viewBox="0 0 32 32" {...stroke}><circle cx="10" cy="10" r="3.5" /><circle cx="22" cy="10" r="3.5" /><path d="M4 26c0-5 2.7-8 6-8s6 3 6 8M16 26c0-5 2.7-8 6-8s6 3 6 8" /></svg>,
  <svg key="plus" viewBox="0 0 32 32" {...stroke}><circle cx="11" cy="11" r="4" /><path d="M3 27c0-5.5 3.6-9 8-9s8 3.5 8 9M24 9v10M19 14h10" /></svg>,
  <svg key="age" viewBox="0 0 32 32"><text x="16" y="21.5" textAnchor="middle" fontSize="13" fontWeight="800" fill="currentColor" style={{ fontFamily: 'var(--font-archivo)' }}>18+</text><circle cx="16" cy="16" r="12.5" fill="none" stroke="currentColor" strokeWidth="2.4" /></svg>,
  <svg key="flag" viewBox="0 0 32 32" {...stroke}><path d="M7 28V5M7 6h17l-4 6 4 6H7" /></svg>,
  <svg key="chat" viewBox="0 0 32 32" {...stroke}><path d="M5 7h22v14H14l-6 5v-5H5z" /><path d="M12 14h8" /></svg>,
  <svg key="refund" viewBox="0 0 32 32" {...stroke}><path d="M6 16a10 10 0 1 0 3-7.1M6 5v4h4" /><path d="M13 12h7M13 15.5h7M15.5 12c3.5 0 3.5 7 0 7h-2l5 4" /></svg>,
];

const tones: Record<string, string> = {
  red: 'bg-red text-white',
  paper: 'bg-paper-3 text-ink',
  butter: 'bg-butter text-ink',
  ink: 'bg-ink-2 text-fg ring-2 ring-fg/20',
};

export default function Safety() {
  return (
    <section id="safety" aria-labelledby="safety-title" className="on-ink curve-top relative z-10 bg-ink py-24 text-fg sm:py-32">
      <div className="shell">
        <div className="grid items-end gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="hand text-[1.6rem] text-red-text sm:text-[1.9rem]">the important bit</p>
            <h2 id="safety-title" className="display mt-2 text-[clamp(2.6rem,8vw,5.4rem)]">
              The fun only works <span className="warm text-red-text">if it’s safe.</span>
            </h2>
          </div>
          <p className="max-w-md text-[1.0625rem] leading-relaxed text-muted lg:justify-self-end">
            We’re asking you to sit down with people you haven’t met. These are the things we built so that feels fine, and stays fine.
          </p>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {safety.map((s, i) => {
            const tilt = [-1.5, 1, -0.5, 2, -2, 1.5, -1][i] ?? 0;
            return (
              <li
                key={s.title}
                data-pop
                className={`tilt wobble relative rounded-[1.6rem] border-2 border-ink p-6 shadow-[0_6px_0_#000] ${tones[s.tone]} ${i === 0 ? 'sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:flex lg:flex-col lg:justify-end' : ''}`}
                style={{ '--tilt': `${tilt}deg`, '--d': i % 4, '--pop-r': `${tilt * 3}deg` } as CSSProperties}
              >
                <span className={`block ${i === 0 ? 'h-14 w-14 lg:h-20 lg:w-20' : 'h-10 w-10'}`} aria-hidden>
                  {icons[i]}
                </span>
                <h3 className={`display-tight mt-4 ${i === 0 ? 'text-[clamp(1.9rem,4vw,3rem)]' : 'text-[1.45rem]'}`}>{s.title}</h3>
                <p className={`mt-2 leading-snug ${i === 0 ? 'max-w-sm text-[1.125rem]' : 'text-[0.9875rem]'}`}>{s.body}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-10 max-w-2xl text-[0.9375rem] leading-relaxed text-muted">
          Payments are confirmed on our server before a seat is yours. If you ever feel unsafe at a meetup, call local emergency
          services first, then tell us.
        </p>
      </div>
    </section>
  );
}
