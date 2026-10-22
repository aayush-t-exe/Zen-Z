import Image, { type StaticImageData } from 'next/image';
import type { ReactNode } from 'react';
import { ScribbleArrow } from '@/components/ui/icons';

/**
 * The illustrated header for About, Pricing, FAQ and Contact: a big Archivo
 * title with room for a Fraunces italic word, a plain intro, and one of the
 * app's illustrations stuck on like a sticker with a handwritten note.
 */
export default function PageHero({
  eyebrow,
  title,
  intro,
  art,
  artAlt = '',
  note,
  updated,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  intro: ReactNode;
  art: StaticImageData;
  artAlt?: string;
  note?: string;
  updated?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-paper pb-14 pt-[calc(var(--header-h)+2.75rem)] sm:pb-20 sm:pt-[calc(var(--header-h)+4.5rem)]">
      <div className="shell grid items-center gap-10 md:grid-cols-[1.15fr_0.85fr] md:gap-12">
        <div>
          <p className="pill bg-butter text-[0.8125rem] -rotate-2">{eyebrow}</p>
          <h1 className="display mt-6 text-[2.85rem] sm:text-[4.25rem] lg:text-[5rem]">{title}</h1>
          <div className="mt-6 max-w-xl text-lg leading-relaxed text-paper-muted sm:text-xl">{intro}</div>
          {updated ? (
            <p className="mt-6 text-sm font-semibold text-paper-muted">Last updated {updated}</p>
          ) : null}
          {children}
        </div>

        <div className="relative mx-auto w-[min(78vw,400px)] md:w-full md:max-w-[420px]">
          <div className="rotate-2 rounded-[2rem] border-2 border-ink bg-paper-3 p-4 shadow-[0_6px_0_#0a0908] sm:p-5">
            <Image
              src={art}
              alt={artAlt}
              priority
              sizes="(min-width: 768px) 420px, 78vw"
              className="h-auto w-full"
            />
          </div>
          {note ? (
            <p className="hand absolute -bottom-10 -left-2 flex items-end gap-1 text-[1.6rem] text-red-deep sm:-left-10">
              <ScribbleArrow
                className="h-10 w-10 -scale-x-100 rotate-[200deg]"
              />
              {note}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
