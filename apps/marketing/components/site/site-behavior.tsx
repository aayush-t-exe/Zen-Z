'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Site-wide behaviour that needs no markup of its own:
 * - reveals [data-pop] elements as they scroll in (CSS does the spring);
 * - Lenis smooth scrolling for mouse wheels only (never touch, never reduced motion);
 * - closes the mobile menu popover when one of its links is used.
 */
export default function SiteBehavior() {
  const pathname = usePathname();

  // Reveals: re-scan on every route change.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-pop]:not(.is-in)'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  // Lenis on wheel devices.
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return;
    let lenis: import('lenis').default | null = null;
    let raf = 0;
    let cancelled = false;
    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({ lerp: 0.12, anchors: { offset: -80 } });
      (window as unknown as { __lenis?: unknown }).__lenis = lenis;
      const loop = (t: number) => {
        lenis?.raf(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      lenis?.destroy();
    };
  }, []);

  // Close the menu popover after navigating from it.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      const pop = a?.closest('[popover]') as (HTMLElement & { hidePopover?: () => void }) | null;
      if (pop?.hidePopover) pop.hidePopover();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
