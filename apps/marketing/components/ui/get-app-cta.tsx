'use client';

import { useSyncExternalStore } from 'react';
import { links } from '@/lib/site';
import { AppleIcon, ArrowRight, PlayIcon } from './icons';

export type Device = 'android' | 'ios' | 'desktop';

function detect(): Device {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  // iPadOS reports a Mac user agent; a touch screen gives it away.
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}

const noop = () => () => {};

/** The visitor's device, or null on the server and before hydration. */
export function useDevice(): Device | null {
  return useSyncExternalStore(noop, detect, () => null);
}

/**
 * The download buttons. The server renders the Android-first default (most
 * students are on Android); the client swaps in the iPhone button on iOS. Every
 * variant has the same shape, a primary button and one text link, so nothing
 * jumps when the device is known.
 */
export default function GetAppCta({
  tone = 'paper',
  className = '',
  desktopHint,
}: {
  tone?: 'paper' | 'ink';
  className?: string;
  /** Extra line shown on desktop only (e.g. "or scan the code on the phone"). */
  desktopHint?: string;
}) {
  const device = useDevice();
  const ios = device === 'ios';
  const subtle = tone === 'ink' ? 'text-muted hover:text-fg' : 'text-paper-muted hover:text-ink';

  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-3 ${className}`}>
      {ios ? (
        <a href={links.getApp} className="btn btn-red">
          <AppleIcon className="h-5 w-5 -translate-y-px" />
          Get Zen-Z on iPhone
        </a>
      ) : (
        <a href={links.play} className={`btn ${tone === 'ink' ? 'btn-paper' : 'btn-ink'}`}>
          <PlayIcon />
          Get it on Google Play
        </a>
      )}
      <a
        href={ios ? links.play : links.getApp}
        className={`group inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold underline decoration-2 underline-offset-4 ${subtle}`}
      >
        {ios ? 'Android? Google Play' : 'iPhone? Get it here'}
        <ArrowRight className="h-4 w-4 transition-transform duration-300 ease-spring group-hover:translate-x-1" />
      </a>
      {device === 'desktop' && desktopHint ? (
        <p className={`hand w-full text-xl ${tone === 'ink' ? 'text-muted' : 'text-paper-muted'}`}>{desktopHint}</p>
      ) : null}
    </div>
  );
}
