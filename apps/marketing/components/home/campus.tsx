import { links } from '@/lib/site';
import { InstagramIcon } from '@/components/ui/icons';

const ink = { fill: 'none', stroke: '#0A0908', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Hawa Mahal as a few lines: the stepped crown and rows of little arched windows. */
function HawaMahal() {
  const rows = [
    { y: 150, n: 9, w: 150 },
    { y: 128, n: 7, w: 118 },
    { y: 106, n: 5, w: 86 },
    { y: 84, n: 3, w: 54 },
  ];
  return (
    <g transform="translate(80 40)">
      <path d="M0 196h170" {...ink} />
      <path d="M10 196V150h150v46" {...ink} fill="#F3B9A9" />
      {rows.map((r, i) => {
        const x0 = 85 - r.w / 2;
        return (
          <g key={i}>
            <path d={`M${x0} ${r.y + 22}V${r.y}h${r.w}v22`} {...ink} fill="#F3B9A9" />
            {Array.from({ length: r.n }).map((_, k) => {
              const cx = x0 + (r.w / r.n) * (k + 0.5);
              return <path key={k} d={`M${cx - 4} ${r.y + 18}v-8a4 4 0 0 1 8 0v8`} {...ink} strokeWidth={1.6} />;
            })}
          </g>
        );
      })}
      <path d="M58 84c0-14 54-14 54 0M85 70v-12" {...ink} />
      <circle cx="85" cy="55" r="3" fill="#E10600" />
      {Array.from({ length: 6 }).map((_, k) => (
        <path key={k} d={`M${24 + k * 24} 190v-14a6 6 0 0 1 12 0v14`} {...ink} strokeWidth={1.6} />
      ))}
    </g>
  );
}

/**
 * Your campus next. A line-art Jaipur with JNU pinned Live. Other colleges are
 * only an honest ask: tell us, we read it. No waitlist form, no "coming soon" list.
 */
export default function Campus() {
  return (
    <section aria-labelledby="campus-title" className="relative overflow-x-clip bg-paper py-24 sm:py-32">
      <div className="shell grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <p className="hand text-[1.6rem] text-red-deep sm:text-[1.9rem]">where we are</p>
          <h2 id="campus-title" className="display mt-2 text-[clamp(2.6rem,8vw,5.2rem)]">
            Live at JNU. <span className="warm text-red-deep">Your campus next?</span>
          </h2>
          <p className="mt-5 max-w-lg text-[1.0625rem] leading-relaxed text-ink/80 sm:text-[1.125rem]">
            Right now Zen-Z runs at Jaipur National University, Jagatpura. Every table is built by hand, so we’re doing one campus
            properly before we try another.
          </p>
          <div className="card-sticker mt-8 max-w-lg bg-paper-3 p-5 sm:p-6">
            <p className="display-tight text-[1.4rem]">Want Zen-Z at your college?</p>
            <p className="mt-1 text-[0.9875rem] text-ink/80">Tell us where you study. We read every message.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={links.instagramDm} className="btn btn-ink !min-h-[2.9rem] text-[0.9375rem]">
                <InstagramIcon className="h-[1.15rem] w-[1.15rem]" />
                DM {links.instagramHandle}
              </a>
              <a
                href={`mailto:${links.email}?subject=${encodeURIComponent('Zen-Z at my college')}`}
                className="btn btn-ghost !min-h-[2.9rem] text-[0.9375rem]"
              >
                Email us
              </a>
            </div>
          </div>
        </div>

        <figure className="relative" data-pop>
          <svg viewBox="0 0 620 460" className="h-auto w-full" role="img" aria-label="A hand-drawn map of Jaipur with JNU in Jagatpura pinned as live.">
            {/* City blob and a few roads. */}
            <path d="M60 120C90 50 220 20 330 40s250 40 260 140-40 210-150 240-300 20-350-40S30 190 60 120Z" fill="#F3EEE3" stroke="#0A0908" strokeWidth="2.2" strokeDasharray="2 8" strokeLinecap="round" />
            <path d="M40 300C150 280 230 250 300 200s170-90 300-80" {...ink} strokeWidth={5} stroke="#DFD8C8" />
            <path d="M170 440C200 350 250 290 330 260s160-20 250 10" {...ink} strokeWidth={5} stroke="#DFD8C8" />
            <path d="M330 30c10 90 0 160 20 230s50 120 40 190" {...ink} strokeWidth={5} stroke="#DFD8C8" />
            <HawaMahal />
            <text x="165" y="268" textAnchor="middle" style={{ fontFamily: 'var(--font-caveat)', fontSize: 28, fontWeight: 600 }} fill="#0A0908">
              Pink City
            </text>
            {/* Dotted route to Jagatpura. */}
            <path d="M210 250C280 300 360 300 440 330" fill="none" stroke="#E10600" strokeWidth="3" strokeDasharray="1 10" strokeLinecap="round" />
            <text x="470" y="404" textAnchor="middle" style={{ fontFamily: 'var(--font-caveat)', fontSize: 26, fontWeight: 600 }} fill="#5C564C">
              Jagatpura
            </text>
          </svg>
          {/* The JNU pin, in HTML so it can pulse. */}
          <div className="absolute left-[73%] top-[71%] -translate-x-1/2 -translate-y-full">
            <div className="flex flex-col items-center">
              <span className="pill rotate-[-4deg] bg-red text-[0.9375rem] text-white">
                JNU · Live
              </span>
              <span aria-hidden className="mt-1 h-6 w-[3px] rounded bg-ink" />
              <span aria-hidden className="pulse relative h-4 w-4 rounded-full border-[3px] border-ink bg-red" />
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
