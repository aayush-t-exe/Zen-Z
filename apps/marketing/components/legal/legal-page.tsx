import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import starSide from '@/assets/art/star-side.webp';
import spark from '@/assets/art/onboarding-spark.webp';
import TocSpy from './toc-spy';
import './legal.css';

export type TocItem = { id: string; title: string };

/** One numbered section of a legal page. Its id feeds the table of contents. */
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`}>{title}</h2>
      {children}
    </section>
  );
}

/** Turns a `{ id: title }` map into the ordered list the contents need. */
export function toc(sections: Record<string, string>): TocItem[] {
  return Object.entries(sections).map(([id, title]) => ({ id, title }));
}

/**
 * The long-form layout for the legal pages: a small sticker header with the
 * date in plain sight, a 680px reading column, and the contents as a sticky
 * rail on desktop or a collapsible list on phones. No motion beyond a tiny
 * scrollspy that marks the current section.
 */
export default function LegalPage({
  title,
  updated,
  lede,
  sections,
  children,
}: {
  title: string;
  updated: string;
  lede: ReactNode;
  sections: TocItem[];
  children: ReactNode;
}) {
  return (
    <main className="bg-paper pb-24 pt-[calc(var(--header-h)+2.5rem)] sm:pt-[calc(var(--header-h)+4rem)]">
      <div className="shell lg:max-w-[calc(984px+2*var(--gutter))]">
        <header className="relative mx-auto max-w-read lg:ml-[304px] lg:mr-0">
          <Image
            src={starSide}
            alt=""
            width={96}
            height={97}
            className="sticker absolute -top-6 right-0 h-16 w-16 rotate-12 sm:-top-8 sm:h-24 sm:w-24"
          />
          <Link
            href="/"
            className="pill bg-paper-3 text-[0.8125rem] !shadow-[0_2px_0_#0a0908]"
          >
            <Image src={spark} alt="" width={14} height={14} className="h-3.5 w-3.5" />
            The fine print
          </Link>
          <h1 className="display mt-5 max-w-[14ch] pr-16 text-[2.6rem] sm:text-[3.6rem]">{title}</h1>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-sm font-semibold text-fg">
            <span className="h-1.5 w-1.5 rounded-full bg-red-text" aria-hidden />
            Last updated {updated}
          </p>
        </header>

        <div className="mt-10 lg:mt-14 lg:grid lg:grid-cols-[240px_minmax(0,680px)] lg:gap-16">
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="legal-toc sticky top-[calc(var(--header-h)+2rem)] max-h-[calc(100vh-var(--header-h)-4rem)] overflow-y-auto pb-4 pr-2">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-paper-muted">On this page</p>
              <ul className="grid gap-0.5">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} data-toc={s.id}>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <TocSpy ids={sections.map((s) => s.id)} />
          </aside>

          <div className="mx-auto max-w-read lg:mx-0">
            <details className="legal-toc-mobile mb-8 rounded-2xl border-2 border-ink bg-paper-3 shadow-[0_3px_0_#0a0908] lg:hidden">
              <summary className="flex items-center justify-between px-5 py-4 font-semibold">
                On this page
                <svg className="legal-toc-chev h-4 w-4 transition-transform" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 6 5 5 5-5" />
                </svg>
              </summary>
              <ul className="grid gap-1 border-t border-ink/10 px-5 pb-4 pt-3 text-[0.9375rem]">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="block py-1 text-paper-muted underline-offset-2 hover:text-ink hover:underline">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>

            <article className="legal-prose">
              <p className="legal-lede">{lede}</p>
              {children}
            </article>
          </div>
        </div>
      </div>
    </main>
  );
}
