'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * One slot-machine pill (222's mad-lib hero). The server renders options[0].
 * The word rolls up and out while the next rolls in from below; the pill's
 * width springs to fit. Tapping rolls it on. Auto-rolls every `every` ms,
 * starting after `delay`, only while on screen; never under reduced motion.
 */
function Pill({
  options,
  every,
  delay,
  tone,
}: {
  options: string[];
  every: number;
  delay: number;
  tone: 'red' | 'paper';
}) {
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [widths, setWidths] = useState<number[] | null>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const lastTap = useRef(0);
  const idx = useRef(0);

  const roll = useCallback(() => {
    setPrev(idx.current);
    idx.current = (idx.current + 1) % options.length;
    setI(idx.current);
  }, [options.length]);

  // Measure every option once fonts are in, so the width can animate.
  useIsoLayoutEffect(() => {
    const m = measure.current;
    if (!m) return;
    const read = () => setWidths(Array.from(m.children).map((c) => (c as HTMLElement).offsetWidth));
    read();
    document.fonts?.ready.then(read);
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer = 0;
    let onScreen = true;
    const tick = () => {
      if (onScreen && !document.hidden) roll();
      timer = window.setTimeout(tick, every);
    };
    const begin = () => (timer = window.setTimeout(tick, delay));
    if (document.readyState === 'complete') begin();
    else window.addEventListener('load', begin, { once: true });
    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
    if (btn.current) io.observe(btn.current);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('load', begin);
      io.disconnect();
    };
  }, [every, delay, roll]);

  const colors =
    tone === 'red'
      ? 'bg-red text-white border-ink'
      : 'bg-paper-3 text-ink border-ink';

  return (
    <button
      ref={btn}
      type="button"
      onClick={() => {
        const now = performance.now();
        if (now - lastTap.current < 280) return;
        lastTap.current = now;
        roll();
      }}
      className={`roll-pill group relative inline-flex items-center rounded-full border-[3px] ${colors} py-[0.08em] pl-[0.42em] pr-[0.3em] align-middle shadow-[0_0.09em_0_#0A0908] transition-transform duration-300 ease-spring active:scale-95`}
    >
      <span
        className="roll-track relative block overflow-hidden"
        style={widths ? { width: `calc(${widths[i]}px + 0.14em)` } : undefined}
      >
        {/* Invisible copy of the current word keeps the line height and the no-JS width. */}
        <span className="invisible block whitespace-nowrap pr-[0.14em]">{options[i]}</span>
        {prev !== null ? (
          <span key={`out-${prev}-${i}`} aria-hidden className="roll-out absolute inset-0 whitespace-nowrap">
            {options[prev]}
          </span>
        ) : null}
        <span key={`in-${i}`} className={`absolute inset-0 whitespace-nowrap ${prev !== null ? 'roll-in' : ''}`}>
          {options[i]}
        </span>
      </span>
      <svg viewBox="0 0 20 20" className="ml-[0.12em] h-[0.5em] w-[0.5em] shrink-0 transition-transform duration-500 ease-spring group-active:rotate-180" aria-hidden>
        <path d="M4 7.5 10 13l6-5.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Measuring row: same font, never visible. */}
      <span ref={measure} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden">
        {options.map((o) => (
          <span key={o} className="block w-max whitespace-nowrap">
            {o}
          </span>
        ))}
      </span>
    </button>
  );
}

/**
 * "Spend [a café evening] with [4 people you haven't met]."
 * Rows stay rows at every width, so a roll only changes a pill's width and
 * never re-wraps the heading (no layout shift).
 */
export default function RollingSentence({
  plans,
  people,
  className = '',
}: {
  plans: string[];
  people: string[];
  className?: string;
}) {
  return (
    <h1 className={`hero-sentence ${className}`}>
      <span className="hs-row">
        <span className="hs-word">Spend</span>{' '}
        <span className="hs-pill">
          <Pill options={plans} every={2600} delay={1800} tone="red" />
        </span>
      </span>{' '}
      <span className="hs-row">
        <span className="hs-word">with</span>{' '}
        <span className="hs-pill">
          <Pill options={people} every={2600} delay={3100} tone="paper" />
          <span className="hs-word">.</span>
        </span>
      </span>
    </h1>
  );
}
