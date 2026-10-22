import type { CSSProperties, ReactNode } from 'react';

const tones = {
  paper: 'bg-paper-3 text-ink [&_a]:text-red-deep',
  butter: 'bg-butter text-ink',
  ink: 'on-ink bg-ink text-fg [&_a]:text-red-text',
  red: 'bg-red text-white [&_a]:text-white',
} as const;

/** A chunky sticker card for the friendly pages. Springs in on scroll. */
export default function InfoCard({
  title,
  children,
  tone = 'paper',
  tilt = 0,
  delay = 0,
  className = '',
  as: Tag = 'div',
  id,
}: {
  title: ReactNode;
  children: ReactNode;
  tone?: keyof typeof tones;
  tilt?: number;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li';
  id?: string;
}) {
  const muted = tone === 'ink' ? 'text-muted' : tone === 'paper' ? 'text-paper-muted' : '';
  return (
    <Tag
      id={id}
      data-pop
      className={`card-sticker p-6 sm:p-7 ${tones[tone]} ${className}`}
      style={{ rotate: `${tilt}deg`, '--d': delay, '--pop-r': `${tilt - 2}deg` } as CSSProperties}
    >
      <h2 className="display-tight text-[1.45rem] sm:text-[1.6rem]">{title}</h2>
      <div
        className={`mt-3 space-y-3 text-[1.0625rem] leading-relaxed [&_a]:font-semibold [&_a]:underline [&_a]:decoration-2 [&_a]:underline-offset-4 ${muted}`}
      >
        {children}
      </div>
    </Tag>
  );
}
