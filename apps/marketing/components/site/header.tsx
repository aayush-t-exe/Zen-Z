import Image from 'next/image';
import Link from 'next/link';
import zGlossy from '@/assets/brand/z-glossy.webp';
import { pageLinks } from '@/lib/site';

const homeLinks = [
  { href: '/#how', label: 'How it works' },
  { href: '/#plans', label: 'Plans' },
  { href: '/#safety', label: 'Safety' },
  { href: '/#faq', label: 'FAQ' },
];

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image src={zGlossy} alt="" width={26} height={29} className="h-[29px] w-[26px]" priority />
      <span className="display-tight text-[1.35rem]">Zen-Z</span>
    </span>
  );
}

/**
 * A floating bar. The mobile menu is a native popover, so it opens without JS.
 * "Get the app" goes to the download section, which knows the device.
 */
export default function SiteHeader() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 pt-[max(0.6rem,env(safe-area-inset-top))]">
      <div className="shell">
        <div className="pointer-events-auto flex h-14 items-center justify-between gap-3 rounded-full border border-ink/10 bg-paper-3/85 pl-4 pr-2 shadow-[0_6px_24px_-12px_rgb(10_9_8/0.35)] backdrop-blur-md backdrop-saturate-150">
          <Link href="/" aria-label="Zen-Z home" className="rounded-full">
            <Wordmark />
          </Link>

          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1 text-[0.9375rem] font-medium">
              {homeLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="rounded-full px-3.5 py-2 transition-colors hover:bg-ink/[0.06]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5">
            <Link href="/#download" className="btn btn-red !min-h-[2.6rem] !px-4 text-[0.9375rem]">
              Get the app
            </Link>
            <button
              type="button"
              popoverTarget="site-menu"
              className="grid h-[2.6rem] w-[2.6rem] place-items-center rounded-full border border-ink/15 md:hidden"
              aria-label="Open menu"
            >
              <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
                <path d="M1 1.5h16M1 10.5h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div
        id="site-menu"
        popover="auto"
        className="pointer-events-auto m-0 mt-[calc(env(safe-area-inset-top)+4.5rem)] w-[calc(100%-2rem)] max-w-sm translate-x-4 rounded-[1.75rem] border-2 border-ink bg-paper-3 p-3 text-ink shadow-[0_6px_0_#0a0908] backdrop:bg-ink/30"
      >
        <nav aria-label="Menu">
          <ul className="grid gap-1 text-lg font-semibold">
            {[...homeLinks, ...pageLinks].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-2xl px-4 py-3 hover:bg-ink/5">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
