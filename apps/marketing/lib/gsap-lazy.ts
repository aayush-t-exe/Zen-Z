'use client';

import { useEffect, useState, type RefObject } from 'react';

type Gsap = typeof import('gsap').gsap;
type ST = typeof import('gsap/ScrollTrigger').ScrollTrigger;

let loading: Promise<{ gsap: Gsap; ScrollTrigger: ST }> | null = null;

/**
 * GSAP + ScrollTrigger, fetched on first use. The scroll-linked sections ask
 * for it only once the visitor scrolls and they come near the viewport, so it
 * never competes with the first paint or the hero. (ScrollTrigger also keeps a
 * requestAnimationFrame loop going for as long as it's loaded, which re-runs
 * style and intersection work every frame; nobody needs that before scrolling.)
 */
export function loadGsap() {
  loading ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([g, s]) => {
    g.gsap.registerPlugin(s.ScrollTrigger);
    return { gsap: g.gsap, ScrollTrigger: s.ScrollTrigger };
  });
  return loading;
}

let scrolled: Promise<void> | null = null;

/** Resolves on the first scroll, or straight away if the page opened scrolled (an anchor, a reload). */
function firstScroll() {
  scrolled ??= new Promise<void>((resolve) => {
    if (window.scrollY > 0) return resolve();
    const events = ['scroll', 'wheel', 'touchmove', 'keydown'] as const;
    const go = () => {
      events.forEach((e) => window.removeEventListener(e, go));
      resolve();
    };
    events.forEach((e) => window.addEventListener(e, go, { passive: true }));
  });
  return scrolled;
}

/** True once the visitor has scrolled and `ref` is within `margin` of the viewport (and stays true). */
export function useNear(ref: RefObject<Element | null>, margin = '600px') {
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    firstScroll().then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el || near || !ready) return;
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
  }, [ref, margin, near, ready]);
  return near;
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
