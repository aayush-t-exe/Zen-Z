'use client';

import { useEffect } from 'react';

/** Marks the contents link of the section being read. Renders nothing. */
export default function TocSpy({ ids }: { ids: string[] }) {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const links = new Map<string, HTMLElement>();
    document.querySelectorAll<HTMLElement>('[data-toc]').forEach((a) => links.set(a.dataset.toc!, a));
    const visible = new Set<string>();
    const mark = () => {
      const current = ids.find((id) => visible.has(id));
      links.forEach((a, id) => a.setAttribute('aria-current', String(id === current)));
    };
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
        mark();
      },
      { rootMargin: '-15% 0px -70% 0px' }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [ids]);
  return null;
}
