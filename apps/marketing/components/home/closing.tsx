import Image from 'next/image';
import zGlossy from '@/assets/brand/z-glossy.webp';
import GetAppCta from '@/components/ui/get-app-cta';
import Qr from '@/components/ui/qr';
import { InstagramIcon } from '@/components/ui/icons';
import { tablePhotos } from '@/lib/media';
import { links } from '@/lib/site';

/** Real meetup photos, once there are some (lib/media.ts). Renders nothing until then. */
function PhotoWall() {
  if (tablePhotos.length < 3) return null;
  return (
    <div className="no-scrollbar -mx-[var(--gutter)] mb-20 flex snap-x gap-4 overflow-x-auto px-[var(--gutter)]">
      {tablePhotos.map((p, i) => (
        <Image
          key={p.src}
          src={p.src}
          alt={p.alt}
          width={p.width}
          height={p.height}
          sizes="320px"
          className={`h-64 w-auto shrink-0 snap-start rounded-2xl border-4 border-white object-cover ${i % 2 ? 'rotate-2' : '-rotate-2'}`}
        />
      ))}
    </div>
  );
}

export default function Closing() {
  return (
    <section id="download" aria-labelledby="download-title" className="on-ink curve-top relative z-10 overflow-x-clip bg-ink pb-24 pt-20 text-fg sm:pb-32 sm:pt-28">
      <div className="cv shell relative">
        <PhotoWall />
        <div className="grid items-center gap-14 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="relative z-10">
            <h2 id="download-title" className="display text-[clamp(4rem,17vw,11rem)] leading-[0.85]">
              Come <span className="warm text-red-text">sit.</span>
            </h2>
            <p className="mt-6 max-w-md text-[1.125rem] leading-relaxed text-muted sm:text-[1.25rem]">
              Every plan runs every week. Pick one, answer a few questions, and we’ll put you at a table where the odds are good.
            </p>
            <GetAppCta tone="ink" className="mt-9" />
            <a href={links.instagram} className="mt-8 inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-muted hover:text-fg">
              <InstagramIcon className="h-5 w-5" />
              {links.instagramHandle} on Instagram
            </a>
          </div>

          <div className="relative mx-auto grid w-full max-w-[13rem] place-items-center sm:max-w-sm">
            <div aria-hidden className="z-glow absolute inset-[-20%] rounded-full" />
            <Image src={zGlossy} alt="" sizes="(min-width: 1024px) 300px, 55vw" className="z-float relative w-[62%] drop-shadow-[0_30px_40px_rgba(225,6,0,0.35)]" />
            {/* Desktop: the QR card. Phones already have the buttons. */}
            <div className="absolute -bottom-6 right-0 hidden w-44 rotate-[6deg] rounded-[1.4rem] border-2 border-ink bg-white p-3 pb-2 text-ink shadow-[0_6px_0_#000] lg:block">
              <Qr className="aspect-square w-full" />
              <p className="hand mt-1 text-center text-[1.3rem] leading-none">scan with your phone</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
