import Image, { type StaticImageData } from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import { zenzDemo } from '@/lib/media';
import LaterShots from './later-shots';

export type Shot = { src: StaticImageData; alt: string };

/**
 * The portfolio's CSS phone. `cycle` wipes through the screens on a CSS loop
 * (first screen only under reduced motion); the screens after the first are
 * added once the page has loaded (later-shots.tsx). When lib/media.ts has a recording,
 * `video` plays it instead. `children` sit on top of the glass (the QR sticker).
 */
export default function Phone({
  shots,
  sizes,
  cycle = false,
  video = false,
  priority = false,
  className = '',
  style,
  children,
}: {
  shots: Shot[];
  sizes: string;
  cycle?: boolean;
  video?: boolean;
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const demo = video ? zenzDemo : null;
  return (
    <div className={`phone ${className}`} style={style}>
      <div
        className={`phone-screen ${cycle && !demo ? 'screen-cycle' : ''}`}
        style={{ '--n': shots.length } as CSSProperties}
      >
        {demo ? (
          <video
            className="phone-shot"
            muted
            playsInline
            loop
            autoPlay
            preload="none"
            poster={demo.poster}
            aria-label="Screen recording of the Zen-Z app"
          >
            {demo.webm ? <source src={demo.webm} type="video/webm" /> : null}
            <source src={demo.mp4} type="video/mp4" />
          </video>
        ) : cycle ? (
          <>
            <Image
              src={shots[0].src}
              alt={shots[0].alt}
              sizes={sizes}
              priority={priority}
              loading={priority ? undefined : 'eager'}
              className="phone-shot"
              style={{ '--i': 0 } as CSSProperties}
            />
            <LaterShots shots={shots.slice(1)} sizes={sizes} />
          </>
        ) : (
          shots.map((s, i) => (
            <Image
              key={i}
              src={s.src}
              alt={i === 0 ? s.alt : ''}
              aria-hidden={i > 0 || undefined}
              sizes={sizes}
              priority={priority && i === 0}
              loading={priority && i === 0 ? undefined : i === 0 ? 'eager' : 'lazy'}
              className="phone-shot"
              style={{ '--i': i } as CSSProperties}
            />
          ))
        )}
      </div>
      <span className="phone-island" aria-hidden />
      {children}
    </div>
  );
}
