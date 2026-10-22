'use client';

import { useEffect, useState, type RefObject } from 'react';

type Gsap = typeof import('gsap').gsap;
type ST = typeof import('gsap/ScrollTrigger').ScrollTrigger;

let loading: Promise<{ gsap: Gsap; ScrollTrigger: ST }> | null = null;

/**
 * GSAP + ScrollTrigger, fetched on first use. The scroll-linked sections ask
 * for it only when they come near the viewport, so it never competes with the
 * first paint or the hero (Lighthouse mobile counts that time).
 */
export function loadGsap() {
  loading ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([g, s]) => {
    g.gsap.registerPlugin(s.ScrollTrigger);
    return { gsap: g.gsap, ScrollTrigger: s.ScrollTrigger };
  });
  return loading;
}

/** True once `ref` is within `margin` of the viewport (and stays true). */
export function useNear(ref: RefObject<Element | null>, margin = '600px') {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: `${margin} 0px ${margin} 0px` }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin, near]);
  return near;
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
