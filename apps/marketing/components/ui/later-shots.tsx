'use client';

import Image, { type StaticImageData } from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * The phone's screens after the first. They only appear from 2.2s into the
 * cycle, so they're added once the page has loaded instead of competing with
 * the hero for bandwidth. Each one's animation-delay is pulled back by how far
 * the first screen's animation has already run, so the CSS cycle stays in step.
 * Nothing is added under reduced motion (only the first screen shows then).
 */
export default function LaterShots({ shots, sizes }: { shots: { src: StaticImageData; alt: string }[]; sizes: string }) {
  const [elapsed, setElapsed] = useState<number | null>(null);
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let idle = 0;
    const go = () => {
      const first = marker.current?.parentElement?.querySelector('.phone-shot');
      const anim = first?.getAnimations()[0];
      setElapsed(typeof anim?.currentTime === 'number' ? anim.currentTime / 1000 : 0);
    };
    const later = () => (idle = window.setTimeout(go, 200));
    if (document.readyState === 'complete') later();
    else window.addEventListener('load', later, { once: true });
    return () => {
      window.removeEventListener('load', later);
      window.clearTimeout(idle);
    };
  }, []);

  if (elapsed === null) return <span ref={marker} hidden />;
  return (
    <>
      {shots.map((s, k) => {
        const i = k + 1;
        return (
          <Image
            key={i}
            src={s.src}
            alt=""
            aria-hidden
            sizes={sizes}
            className="phone-shot"
            style={{ '--i': i, animationDelay: `${(i * 2.8 - 0.6 - elapsed).toFixed(3)}s` } as CSSProperties}
          />
        );
      })}
    </>
  );
}
