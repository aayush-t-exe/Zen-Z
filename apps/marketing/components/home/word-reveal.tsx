'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

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
  const words = text.split(' ');

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const els = gsap.utils.toArray<HTMLElement>('.wr-word', scope.current);
        // Dim is #6F6A62 on ink (3.6:1, fine for this large type), never opacity.
        gsap.set(els, { '--lit': 0 });
        gsap.to(els, {
          '--lit': 1,
          ease: 'none',
          stagger: 0.12,
          scrollTrigger: {
            trigger: scope.current,
            start: 'top 82%',
            end: 'bottom 45%',
            scrub: 0.6,
          },
        });
      });
      return () => mm.revert();
    },
    { scope }
  );

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
