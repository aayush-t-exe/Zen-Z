'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import zGlossy from '@/assets/brand/z-glossy.webp';

type Lenis = { scrollTo: (t: string | Element, o?: { offset?: number; duration?: number }) => void };

function goTo(target: string) {
  const el = document.querySelector(target);
  if (!el) return;
  const lenis = (window as unknown as { __lenis?: Lenis }).__lenis;
  if (lenis) lenis.scrollTo(el, { offset: -72, duration: 1.4 });
  else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * The glossy red Z hanging from the nav on a stretchy cord (Charmling's charm).
 * Drag it and let go: it swings on a verlet rope (lib/rope.ts, loaded after
 * first paint). A long pull drops you to `target`. A tap gives it a nudge;
 * Enter/Space jumps to `target`.
 *
 * Without JS, or under reduced motion, it's a still Z on a straight cord. The
 * cord length comes from the `--len` CSS variable so the server render and
 * the simulation agree at every breakpoint.
 */
export default function HangingZ({
  className = '',
  target = '#how',
  note = 'pull me',
}: {
  className?: string;
  target?: string;
  note?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const zRef = useRef<HTMLButtonElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const noteRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    const z = zRef.current;
    const path = pathRef.current;
    if (!el || !z || !path) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    let raf = 0;
    let running = false;
    let visible = true;
    let last = 0;
    let dragging = false;
    let lastTouch = 0;
    let cleanup = () => {};
    // The breeze (an always-running loop) is for desktop. On phones the rope
    // only simulates while you play with it, then sleeps and a CSS sway takes over.
    const breezy = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches;

    import('@/lib/rope').then(({ Rope }) => {
      if (cancelled) return;
      const len = parseFloat(getComputedStyle(el).getPropertyValue('--len')) || 160;
      const rope = new Rope({ length: len, segments: 12, wind: breezy });
      el.dataset.live = 'true';

      const draw = () => {
        path.setAttribute('d', rope.path());
        z.style.transform = `translate3d(${rope.endX.toFixed(1)}px, ${rope.endY.toFixed(1)}px, 0) rotate(${(-rope.angle).toFixed(4)}rad)`;
      };

      const frame = (t: number) => {
        const dt = last ? (t - last) / 1000 : 1 / 60;
        last = t;
        const speed = rope.update(dt);
        draw();
        if (!breezy && !dragging && speed < 6 && t - lastTouch > 900) {
          running = false;
          el.dataset.sleep = 'true';
          return;
        }
        raf = requestAnimationFrame(frame);
      };
      const start = () => {
        if (running || !visible || document.hidden) return;
        if (!breezy && el.dataset.sleep === 'true') return;
        running = true;
        last = 0;
        raf = requestAnimationFrame(frame);
      };
      const stop = () => {
        running = false;
        cancelAnimationFrame(raf);
      };

      // Pointer drag, relative to the anchor (the element's own origin).
      let moved = 0;
      let sx = 0;
      let sy = 0;
      let vx = 0;
      let vy = 0;
      let lt = 0;
      let lx = 0;
      let ly = 0;
      let grabDx = 0;
      let grabDy = 0;

      const local = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      const onDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        dragging = true;
        lastTouch = performance.now();
        el.dataset.sleep = 'false';
        moved = 0;
        z.setPointerCapture(e.pointerId);
        const p = local(e);
        sx = lx = p.x;
        sy = ly = p.y;
        grabDx = rope.endX - p.x;
        grabDy = rope.endY - p.y;
        lt = performance.now();
        vx = vy = 0;
        rope.pin = rope.reach(p.x + grabDx, p.y + grabDy);
        el.dataset.drag = 'true';
        start();
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const p = local(e);
        const now = performance.now();
        const dt = Math.max(1, now - lt) / 1000;
        // Smoothed pointer velocity for the release.
        vx = vx * 0.6 + ((p.x - lx) / dt) * 0.4;
        vy = vy * 0.6 + ((p.y - ly) / dt) * 0.4;
        lx = p.x;
        ly = p.y;
        lt = now;
        moved = Math.max(moved, Math.hypot(p.x - sx, p.y - sy));
        rope.pin = rope.reach(p.x + grabDx, p.y + grabDy);
      };
      const onUp = (e: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        lastTouch = performance.now();
        el.dataset.drag = 'false';
        try {
          z.releasePointerCapture(e.pointerId);
        } catch {}
        if (moved < 6) {
          rope.pin = null;
          rope.nudge(Math.random() < 0.5 ? -700 : 700, -200);
          return;
        }
        // A good pull is mostly downward and well past the cord's length; a sideways fling just swings.
        const goodPull = rope.endY > rope.length * 1.5 && Math.abs(rope.endX) < rope.endY * 0.6;
        rope.release(vx, vy);
        if (goodPull) {
          if (noteRef.current) noteRef.current.textContent = 'wheee';
          window.setTimeout(() => goTo(target), 220);
        }
      };

      z.addEventListener('pointerdown', onDown);
      z.addEventListener('pointermove', onMove);
      z.addEventListener('pointerup', onUp);
      z.addEventListener('pointercancel', onUp);

      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      });
      io.observe(el.parentElement ?? el);
      const onVis = () => (document.hidden ? stop() : start());
      document.addEventListener('visibilitychange', onVis);

      draw();
      if (!breezy) el.dataset.sleep = 'true';
      start();

      cleanup = () => {
        stop();
        io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        z.removeEventListener('pointerdown', onDown);
        z.removeEventListener('pointermove', onMove);
        z.removeEventListener('pointerup', onUp);
        z.removeEventListener('pointercancel', onUp);
      };
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [target]);

  return (
    <div ref={root} className={`hanging-z absolute top-0 z-20 h-0 w-0 ${className}`}>
      {/* Static cord (server render, no JS, reduced motion). */}
      <span aria-hidden className="hz-static-cord absolute left-[-1px] top-0 w-[2.5px] rounded-full bg-ink" style={{ height: 'var(--len)' }} />
      {/* Live cord. */}
      <svg aria-hidden className="hz-live-cord pointer-events-none absolute left-0 top-0 h-px w-px overflow-visible">
        <path ref={pathRef} d="M0 0" fill="none" stroke="#0A0908" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <button
        ref={zRef}
        type="button"
        aria-label="Pull the Z: it takes you to how it works"
        onClick={(e) => {
          // Keyboard activation only; pointer taps are handled as a nudge.
          if (e.detail === 0) goTo(target);
        }}
        className="hz-z absolute left-0 top-0 block cursor-grab touch-none select-none rounded-[40%] active:cursor-grabbing"
        style={{ width: 'var(--zw)', marginLeft: 'calc(var(--zw) / -2)', transformOrigin: '50% 0' }}
      >
        <span className="hz-sway relative block">
          {/* The little ring the cord is tied to. */}
          <span aria-hidden className="absolute left-1/2 top-[-7px] h-[14px] w-[14px] -translate-x-1/2 rounded-full border-[2.5px] border-ink" />
          {/* The shadow is its own soft ellipse, not a filter on the image: a
              filter's blur counts toward the image's paint size, which made this
              decoration the page's LCP element instead of the headline. */}
          <span aria-hidden className="absolute inset-x-[12%] bottom-[-14%] h-[22%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(120,10,0,0.32),transparent)]" />
          <Image
            src={zGlossy}
            alt=""
            sizes="(min-width: 1024px) 160px, 96px"
            className="pointer-events-none relative h-auto w-full"
            loading="eager"
            draggable={false}
          />
        </span>
      </button>
      <span
        aria-hidden
        className="hz-note hand pointer-events-none absolute whitespace-nowrap text-[1.45rem] text-red-deep lg:text-[1.7rem]"
      >
        <span ref={noteRef}>{note}</span> ↓
      </span>
    </div>
  );
}
