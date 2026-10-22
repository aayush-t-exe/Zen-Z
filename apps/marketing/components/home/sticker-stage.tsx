'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Wraps a scatter of stickers. Every descendant with `data-depth` (0–1):
 * - on desktop, drifts with scroll (parallax) and leans toward the cursor;
 * - can be dragged (mouse or touch) and stays where it's dropped, with a
 *   springy lift while held. `data-drag="off"` opts a sticker out.
 * Transforms go on each sticker directly; nothing animates under reduced motion.
 */
export default function StickerStage({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // The parallax loop is a desktop treat. Phones get drag only, so nothing
    // runs per frame unless a finger is on a sticker.
    const desktop = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches;

    type S = { el: HTMLElement; depth: number; rot: number; dx: number; dy: number; held: boolean };
    const items: S[] = Array.from(stage.querySelectorAll<HTMLElement>('[data-depth]')).map((el) => ({
      el,
      depth: parseFloat(el.dataset.depth || '0.3'),
      rot: parseFloat(el.dataset.rot || '0'),
      dx: 0,
      dy: 0,
      held: false,
    }));

    let mx = 0;
    let my = 0;
    let cx = 0;
    let cy = 0;
    let scrollY = 0;
    let raf = 0;
    let visible = true;

    const place = (s: S) => {
      const px = cx * 18 * s.depth;
      const py = cy * 14 * s.depth - scrollY * 0.12 * s.depth;
      const lift = s.held ? ' scale(1.08)' : '';
      const r = s.held ? s.rot - 4 : s.rot + cx * 2 * s.depth;
      s.el.style.transform = `translate3d(${(s.dx + px).toFixed(1)}px, ${(s.dy + py).toFixed(1)}px, 0) rotate(${r.toFixed(2)}deg)${lift}`;
    };
    const apply = () => {
      cx += (mx - cx) * 0.08;
      cy += (my - cy) * 0.08;
      items.forEach(place);
      raf = visible ? requestAnimationFrame(apply) : 0;
    };

    const onPointer = (e: PointerEvent) => {
      mx = (e.clientX / window.innerWidth) * 2 - 1;
      my = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onScroll = () => {
      const r = stage.getBoundingClientRect();
      scrollY = -r.top;
    };
    if (desktop) {
      window.addEventListener('pointermove', onPointer, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    // Dragging.
    const offs: (() => void)[] = [];
    for (const s of items) {
      if (s.el.dataset.drag === 'off') continue;
      s.el.style.touchAction = 'none';
      s.el.style.cursor = 'grab';
      let sx = 0;
      let sy = 0;
      let bx = 0;
      let by = 0;
      const down = (e: PointerEvent) => {
        if (e.button !== 0) return;
        s.held = true;
        if (!desktop) place(s);
        s.el.setPointerCapture(e.pointerId);
        s.el.style.cursor = 'grabbing';
        s.el.style.zIndex = '30';
        sx = e.clientX;
        sy = e.clientY;
        bx = s.dx;
        by = s.dy;
      };
      const move = (e: PointerEvent) => {
        if (!s.held) return;
        s.dx = bx + e.clientX - sx;
        s.dy = by + e.clientY - sy;
        if (!desktop) place(s);
      };
      const up = () => {
        s.held = false;
        s.el.style.cursor = 'grab';
        if (!desktop) place(s);
      };
      s.el.addEventListener('pointerdown', down);
      s.el.addEventListener('pointermove', move);
      s.el.addEventListener('pointerup', up);
      s.el.addEventListener('pointercancel', up);
      offs.push(() => {
        s.el.removeEventListener('pointerdown', down);
        s.el.removeEventListener('pointermove', move);
        s.el.removeEventListener('pointerup', up);
        s.el.removeEventListener('pointercancel', up);
      });
    }

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (desktop && visible && !raf) raf = requestAnimationFrame(apply);
    });
    io.observe(stage);
    if (desktop) raf = requestAnimationFrame(apply);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      offs.forEach((f) => f());
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
