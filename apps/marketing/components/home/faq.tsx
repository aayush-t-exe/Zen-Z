import Link from 'next/link';
import { homeFaqs } from '@/lib/content';

export default function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="relative bg-paper py-24 sm:py-32">
      <div className="shell grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div>
          <p className="hand text-[1.6rem] text-red-deep sm:text-[1.9rem]">fair questions</p>
          <h2 id="faq-title" className="display mt-2 text-[clamp(2.6rem,8vw,5rem)]">
            Things people <span className="warm text-red-deep">ask us.</span>
          </h2>
          <p className="mt-5 max-w-sm text-[1.0625rem] leading-relaxed text-ink/80">
            The rest are on the{' '}
            <Link href="/faq" className="font-semibold text-red-deep underline decoration-2 underline-offset-4">
              FAQ page
            </Link>
            , or ask us on Instagram.
          </p>
        </div>
        <div className="grid gap-3">
          {homeFaqs.map((f, i) => (
            <details key={f.q} className="faq group rounded-[1.4rem] border-2 border-ink bg-paper-3 shadow-[0_4px_0_#0A0908]" open={i === 0}>
              <summary className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5">
                <span className="display-tight text-[1.2rem] sm:text-[1.4rem]">{f.q}</span>
                <span aria-hidden className="faq-plus grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red text-white">
                  <svg viewBox="0 0 16 16" className="h-4 w-4">
                    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </span>
              </summary>
              <p className="px-5 pb-5 text-[1rem] leading-relaxed text-ink/80 sm:px-6 sm:pb-6 sm:text-[1.0625rem]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
