// Small inline icons and hand-drawn marks. All decorative unless labelled.

export function PlayIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 26" className={className} aria-hidden>
      <path d="M1.2 1.1 13.6 13 1.2 24.9c-.4-.3-.7-.8-.7-1.4V2.5c0-.6.3-1.1.7-1.4Z" fill="#34A853" />
      <path d="m17.8 8.9-4.2 4.1-12.4-11.9c.5-.4 1.2-.5 1.9-.1l14.7 7.9Z" fill="#4285F4" />
      <path d="M17.8 17.1 3.1 25c-.7.4-1.4.3-1.9-.1L13.6 13l4.2 4.1Z" fill="#EA4335" />
      <path d="m22.4 14.6-4.6 2.5-4.2-4.1 4.2-4.1 4.6 2.5c1.1.6 1.1 2.6 0 3.2Z" fill="#FBBC04" />
    </svg>
  );
}

export function AppleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 24" className={className} aria-hidden fill="currentColor">
      <path d="M16.5 12.7c0-2.9 2.4-4.3 2.5-4.4-1.4-2-3.5-2.3-4.3-2.3-1.8-.2-3.5 1.1-4.4 1.1-.9 0-2.3-1-3.8-1-1.9 0-3.7 1.1-4.7 2.9-2 3.5-.5 8.7 1.4 11.5 1 1.4 2.1 2.9 3.6 2.9 1.4-.1 2-.9 3.7-.9s2.2.9 3.7.9c1.5 0 2.5-1.4 3.4-2.8 1.1-1.6 1.5-3.1 1.6-3.2-.1 0-2.7-1-2.7-4.7ZM13.7 4.1c.8-1 1.3-2.3 1.2-3.6-1.1 0-2.5.8-3.3 1.7-.7.8-1.4 2.2-1.2 3.5 1.3.1 2.5-.6 3.3-1.6Z" />
    </svg>
  );
}

export function InstagramIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ArrowRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10h13M11 4.5 16.5 10 11 15.5" />
    </svg>
  );
}

/** A loose, hand-drawn arrow for margin notes. Points down-right by default. */
export function ScribbleArrow({ className = '', d = 'M6 8c10 4 26 6 36 22 4 7 5 15 4 22m0 0-9-8m9 8 7-10' }: { className?: string; d?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/**
 * A small hand-drawn arrow that sits inline in a handwritten note. Caveat has
 * no arrow glyphs, and falling back to a system font for one character made
 * the hero's first layout noticeably slower. Points down; rotate it as needed.
 */
export function NoteArrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 22" className={`inline-block h-[0.8em] w-[0.6em] align-[-0.05em] ${className}`} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 2c-.6 5 .4 11-.3 17M3 13.5c2 2 3.6 3.8 5.2 5.6 1.4-2 2.9-3.7 4.8-5.3" />
    </svg>
  );
}

/** A hand-drawn circle to ring a word. Stretch it over the target. */
export function ScribbleCircle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 80" preserveAspectRatio="none" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M118 6C64 2 10 14 6 40c-4 26 60 36 112 34 46-2 80-14 76-36C190 14 140 4 96 8" />
    </svg>
  );
}

/** A hand-drawn underline. */
export function ScribbleUnderline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 16" preserveAspectRatio="none" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
      <path d="M3 11C40 4 90 3 197 7M60 13c40-3 80-4 118-3" />
    </svg>
  );
}

/** Four-point sparkle doodle. */
export function Sparkle({ className = '', ...rest }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor" {...rest}>
      <path d="M12 0c.9 6.4 2.6 9.9 12 12-9.4 2.1-11.1 5.6-12 12-.9-6.4-2.6-9.9-12-12C9.4 9.9 11.1 6.4 12 0Z" />
    </svg>
  );
}
