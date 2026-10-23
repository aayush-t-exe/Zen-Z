'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import zGlossy from '@/assets/brand/z-glossy.webp';
import { links } from '@/lib/site';
import { useDevice } from '@/components/ui/get-app-cta';
import { AppleIcon, PlayIcon } from '@/components/ui/icons';

/**
 * The download pill that follows you once the hero is gone (CRED, Grail).
 *
 * Desktop: a small round Z button in the corner, so it never sits on top of
 * content. Hover, focus or a click opens the QR card; Esc, a second click or
 * moving away closes it. It hides while one of the page's own QR codes
 * (`[data-qr-spot]`) is on screen, since a second code there is just noise.
 *
 * Phones: a full-width button. While it shows, <html data-bar="on"> tells the
 * header to fade its own red button, so there's only ever one on screen.
 *
 * Both step aside once the closing download section is reached. `qr` is the
 * server-rendered code.
 */
export default function StickyGet({ qr, heroId = 'top', hideId = 'download' }: { qr: ReactNode; heroId?: string; hideId?: string }) {
  const device = useDevice();
  const [pastHero, setPastHero] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const [qrInView, setQrInView] = useState(false);

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
    const spots = document.querySelectorAll('[data-qr-spot]');
    if (spots.length) {
      const seen = new Set<Element>();
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) seen.add(e.target);
          else seen.delete(e.target);
        }
        setQrInView(seen.size > 0);
      });
      spots.forEach((s) => io.observe(s));
      ios.push(io);
    }
    return () => ios.forEach((io) => io.disconnect());
  }, [heroId, hideId]);

  const desktop = device === 'desktop';
  const show = pastHero && !atEnd && device !== null && !(desktop && qrInView);
  const bar = show && !desktop;

  useEffect(() => {
    const root = document.documentElement;
    if (bar) root.dataset.bar = 'on';
    else delete root.dataset.bar;
    return () => {
      delete root.dataset.bar;
    };
  }, [bar]);

  if (device === null) return null;
  if (desktop) return <QrCorner qr={qr} show={show} />;

  const ios = device === 'ios';
  return (
    <div
      data-show={show ? 'true' : 'false'}
      inert={!show}
      className="sticky-get sticky-bar fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <a
        href={ios ? links.getApp : links.play}
        className="btn btn-red w-full max-w-sm !min-h-[3.5rem] text-[1.05rem] shadow-[0_4px_0_#A80400,0_14px_30px_-10px_rgb(10_9_8/0.5)]"
      >
        {ios ? <AppleIcon className="h-5 w-5 -translate-y-px" /> : <PlayIcon />}
        {ios ? 'Get Zen-Z on iPhone' : 'Get it on Google Play'}
      </a>
    </div>
  );
}

/** The desktop corner button and the QR card it opens. */
function QrCorner({ qr, show }: { qr: ReactNode; show: boolean }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const open = show && (hover || focus || pinned);

  const close = useCallback(() => {
    setHover(false);
    setFocus(false);
    setPinned(false);
  }, []);

  // Shut it when the corner hides, so it never comes back already open.
  useEffect(() => {
    if (!show) close();
  }, [show, close]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
      btn.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <div
      data-show={show ? 'true' : 'false'}
      data-open={open ? 'true' : 'false'}
      inert={!show}
      className="sticky-get qr-corner fixed bottom-6 right-6 z-40"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(true)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(false)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <div
        id="qr-corner-card"
        role="group"
        aria-label="Get Zen-Z"
        aria-hidden={!open}
        className="qr-card absolute bottom-[calc(100%+0.75rem)] right-0 w-[15rem] rounded-[1.4rem] border-2 border-ink bg-paper-3 p-3 pb-3.5 text-center shadow-[0_5px_0_#0A0908]"
      >
        <span className="block rounded-xl bg-white p-2.5">{qr}</span>
        <p className="display-tight mt-3 text-[1.2rem]">Get Zen-Z</p>
        <p className="text-sm font-medium text-paper-muted">Scan with your phone</p>
      </div>
      <button
        ref={btn}
        type="button"
        aria-label="Get Zen-Z: show the QR code"
        aria-expanded={open}
        aria-controls="qr-corner-card"
        onClick={() => (open ? close() : setPinned(true))}
        onFocus={(e) => e.currentTarget.matches(':focus-visible') && setFocus(true)}
        className="qr-corner-btn grid h-14 w-14 place-items-center rounded-full border-2 border-ink bg-paper-3 shadow-[0_4px_0_#0A0908]"
      >
        <Image src={zGlossy} alt="" width={26} height={29} className="h-[29px] w-[26px]" />
      </button>
    </div>
  );
}
