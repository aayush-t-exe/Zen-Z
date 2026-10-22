'use client';

import { useEffect, useRef } from 'react';
import { loadGsap, useNear } from '@/lib/gsap-lazy';

/**
 * CRED/Opal-style reading reveal: each word goes from dim to cream as the
 * paragraph scrolls through the viewport. Server-rendered at full brightness;
 * only once GSAP runs (and motion is allowed) do the words start dim, so the
 * text is always readable without JS. `accent` words light up red.
 */
export default function WordReveal({
  text,
  accent = [],
  className = '',
}: {
  text: string;
  accent?: string[];
  className?: string;
}) {
  const scope = useRef<HTMLParagraphElement>(null);
  const near = useNear(scope);
  const words = text.split(' ');

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let revert = () => {};
    loadGsap().then(({ gsap }) => {
      if (cancelled) return;
      const ctx = gsap.context(() => {
        const mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
          const els = gsap.utils.toArray<HTMLElement>('.wr-word');
          // Dim is #6F6A62 on ink (3.6:1, fine for this large type), never opacity.
          gsap.set(els, { '--lit': 0 });
          gsap.to(els, {
            '--lit': 1,
            ease: 'none',
            stagger: 0.12,
            scrollTrigger: { trigger: scope.current, start: 'top 82%', end: 'bottom 45%', scrub: 0.6 },
          });
        });
      }, scope);
      revert = () => ctx.revert();
    });
    return () => {
      cancelled = true;
      revert();
    };
  }, [near]);

  return (
    <p ref={scope} className={className}>
      {words.map((w, i) => {
        const clean = w.replace(/[.,]/g, '');
        const hot = accent.includes(clean);
        return (
          <span key={i} className={`wr-word ${hot ? 'wr-hot warm' : ''}`}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </p>
  );
}
