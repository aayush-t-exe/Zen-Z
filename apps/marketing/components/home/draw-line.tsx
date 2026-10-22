'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { loadGsap, useNear } from '@/lib/gsap-lazy';

/**
 * Meetup's hand-drawn connector. Measures every `[data-anchor]` inside and
 * draws one loose, slightly wobbly line through them, behind the content. The
 * line draws itself as you scroll (scrubbed). Without JS there's no line,
 * and under reduced motion it's drawn in full.
 */
export default function DrawLine({ children, className = '' }: { children: ReactNode; className?: string }) {
  const scope = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const [d, setD] = useState('');
  const [box, setBox] = useState({ w: 0, h: 0 });
  const near = useNear(scope);

  useEffect(() => {
    const el = scope.current;
    if (!el || !near) return;
    const build = () => {
      const r = el.getBoundingClientRect();
      const pts = Array.from(el.querySelectorAll<HTMLElement>('[data-anchor]')).map((a) => {
        const b = a.getBoundingClientRect();
        return { x: b.left + b.width / 2 - r.left, y: b.top + b.height / 2 - r.top };
      });
      if (pts.length < 2) return;
      let s = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const dy = b.y - a.y;
        // Swing out to one side between stops, alternating, like a pen loop.
        const swing = (i % 2 ? 1 : -1) * Math.min(90, Math.abs(b.x - a.x) * 0.25 + 40);
        const cx = (x: number) => Math.max(4, Math.min(r.width - 4, x)).toFixed(1);
        s += ` C${cx(a.x + swing)} ${(a.y + dy * 0.45).toFixed(1)} ${cx(b.x - swing)} ${(b.y - dy * 0.55).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
      }
      setBox({ w: r.width, h: r.height });
      setD(s);
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(el);
    document.fonts?.ready.then(build);
    return () => ro.disconnect();
  }, [near]);

  useEffect(() => {
    const p = path.current;
    if (!p || !d) return;
    let cancelled = false;
    let revert = () => {};
    loadGsap().then(({ gsap }) => {
      if (cancelled) return;
      const len = p.getTotalLength();
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          p,
          { strokeDasharray: len, strokeDashoffset: len },
          {
            strokeDashoffset: 0,
            ease: 'none',
            scrollTrigger: { trigger: scope.current, start: 'top 70%', end: 'bottom 75%', scrub: 0.8 },
          }
        );
      });
      revert = () => mm.revert();
    });
    return () => {
      cancelled = true;
      revert();
    };
  }, [d]);

  return (
    <div ref={scope} className={`relative ${className}`}>
      {d ? (
        <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={box.w} height={box.h}>
          <path ref={path} d={d} fill="none" stroke="#E10600" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
      {children}
    </div>
  );
}
