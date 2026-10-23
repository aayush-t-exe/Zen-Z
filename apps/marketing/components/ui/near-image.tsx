'use client';

import Image, { type StaticImageData } from 'next/image';
import { useEffect, useRef, useState } from 'react';

/**
 * A below-the-fold picture that isn't fetched until it's within `margin` of
 * the viewport. Native lazy loading starts far earlier than that on phones,
 * so the how-it-works art was downloading alongside the hero. Until then a
 * box with the image's aspect ratio holds its place, so nothing shifts.
 */
export default function NearImage({
  src,
  alt,
  sizes,
  className = '',
  margin = '800px',
}: {
  src: StaticImageData;
  alt: string;
  sizes: string;
  className?: string;
  margin?: string;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = box.current;
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
  }, [near, margin]);

  if (near) return <Image src={src} alt={alt} sizes={sizes} className={className} />;
  return (
    <>
      {/* Without JS the box steps aside for the <noscript> copy. */}
      <span ref={box} aria-hidden className={`block [html:not(.js)_&]:hidden ${className}`} style={{ aspectRatio: `${src.width} / ${src.height}` }} />
      <noscript>
        <Image src={src} alt={alt} sizes={sizes} className={className} />
      </noscript>
    </>
  );
}
