import type { ReactNode } from 'react';

/** Bumble's rotating circular-text badge, in our colours. Text is decorative; `label` is read. */
export default function CircleBadge({
  text,
  label,
  children,
  className = '',
  ring = '#E10600',
  ink = '#FFFFFF',
}: {
  text: string;
  label: string;
  children?: ReactNode;
  className?: string;
  ring?: string;
  ink?: string;
}) {
  const id = `cb-${text.replace(/[^a-z]/gi, '').slice(0, 12)}`;
  return (
    <div role="img" aria-label={label} className={`relative aspect-square ${className}`}>
      <svg viewBox="0 0 200 200" className="spin-slow absolute inset-0 h-full w-full" aria-hidden>
        <circle cx="100" cy="100" r="98" fill={ring} />
        <defs>
          <path id={id} d="M100 100m-74 0a74 74 0 1 1 148 0a74 74 0 1 1-148 0" />
        </defs>
        <text fill={ink} style={{ fontFamily: 'var(--font-archivo)', fontWeight: 800, fontSize: 19, letterSpacing: 3 }}>
          <textPath href={`#${id}`}>{text}</textPath>
        </text>
      </svg>
      <div className="absolute inset-[26%] grid place-items-center">{children}</div>
    </div>
  );
}
