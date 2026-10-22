'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { links } from '@/lib/site';
import { useDevice } from '@/components/ui/get-app-cta';
import { AppleIcon, PlayIcon } from '@/components/ui/icons';

/**
 * The download pill that follows you once the hero is gone (CRED, Grail): a
 * small QR card on desktop, a full-width button on phones. It steps aside when
 * the closing download section is on screen. `qr` is the server-rendered code.
 */
export default function StickyGet({ qr, heroId = 'top', hideId = 'download' }: { qr: ReactNode; heroId?: string; hideId?: string }) {
  const device = useDevice();
  const [pastHero, setPastHero] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    const end = document.getElementById(hideId);
    const ios: IntersectionObserver[] = [];
    if (hero) {
      const io = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting && e.boundingClientRect.top < 0), {
        rootMargin: '0px 0px -40% 0px',
      });
      io.observe(hero);
      ios.push(io);
    }
    if (end) {
      // Once the closing section is reached, stay out of the way (it and the footer have their own buttons).
      const io = new IntersectionObserver(([e]) => setAtEnd(e.isIntersecting || e.boundingClientRect.top < 0));
      io.observe(end);
      ios.push(io);
    }
    return () => ios.forEach((io) => io.disconnect());
  }, [heroId, hideId]);

  const show = pastHero && !atEnd && device !== null;
  const ios = device === 'ios';

  return (
    <div
      ref={ref}
      data-show={show ? 'true' : 'false'}
      inert={!show}
      className="sticky-get fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:inset-x-auto md:right-6 md:justify-end md:pb-6"
    >
      {device === 'desktop' ? (
        <a
          href="#download"
          className="flex items-center gap-3 rounded-[1.4rem] border-2 border-ink bg-paper-3 p-2.5 pr-5 shadow-[0_5px_0_#0A0908]"
        >
          <span className="block h-[4.75rem] w-[4.75rem] rounded-xl bg-white p-1.5">{qr}</span>
          <span className="grid gap-0.5">
            <span className="display-tight text-[1.15rem]">Get Zen-Z</span>
            <span className="text-sm font-medium text-paper-muted">Scan with your phone</span>
          </span>
        </a>
      ) : (
        <a
          href={ios ? links.getApp : links.play}
          className="btn btn-red w-full max-w-sm !min-h-[3.5rem] text-[1.05rem] shadow-[0_4px_0_#A80400,0_14px_30px_-10px_rgb(10_9_8/0.5)]"
        >
          {ios ? <AppleIcon className="h-5 w-5 -translate-y-px" /> : <PlayIcon />}
          {ios ? 'Get Zen-Z on iPhone' : 'Get it on Google Play'}
        </a>
      )}
    </div>
  );
}
