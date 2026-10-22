import Link from 'next/link';
import { legalLinks, links, operator, pageLinks } from '@/lib/site';
import { Wordmark } from './header';

/**
 * On every page, including 404: the operator block PayU and Google Play check
 * (name, postal address, email, phones) and every legal link, Delete Account
 * included.
 */
export default function SiteFooter() {
  return (
    <footer className="site-footer on-ink curve-top relative z-10 bg-ink text-fg">
      <div className="shell pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-14 sm:pt-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="Zen-Z home" className="inline-block rounded-full">
              <Wordmark />
            </Link>
            <p className="mt-4 max-w-xs text-[0.9375rem] leading-relaxed text-muted">
              A table of new people, built by hand. Live at JNU Jaipur.
            </p>
          </div>

          <nav aria-label="Pages">
            <h2 className="text-sm font-semibold text-fg">Zen-Z</h2>
            <ul className="mt-3 grid gap-2 text-[0.9375rem] text-muted">
              <li><Link href="/" className="hover:text-fg">Home</Link></li>
              {pageLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-fg">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal">
            <h2 className="text-sm font-semibold text-fg">The fine print</h2>
            <ul className="mt-3 grid gap-2 text-[0.9375rem] text-muted">
              {legalLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-fg">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-semibold text-fg">Get it</h2>
            <ul className="mt-3 grid gap-2 text-[0.9375rem] text-muted">
              <li><a href={links.play} className="hover:text-fg">Google Play</a></li>
              <li><a href={links.getApp} className="hover:text-fg">iPhone (web app)</a></li>
              <li><a href={links.instagram} className="hover:text-fg">Instagram {links.instagramHandle}</a></li>
            </ul>
          </div>
        </div>

        <address className="mt-12 grid gap-1 border-t border-fg/10 pt-6 text-[0.8125rem] not-italic leading-relaxed text-muted">
          <p>
            Zen-Z is operated by <span className="text-fg">{operator.name}</span> · {operator.kind}
          </p>
          <p>{operator.address}</p>
          <p>
            <a href={`mailto:${operator.email}`} className="underline-offset-2 hover:text-fg hover:underline">
              {operator.email}
            </a>
            {operator.phones.map((p) => (
              <span key={p}>
                {' · '}
                <a href={`tel:+91${p}`} className="underline-offset-2 hover:text-fg hover:underline">
                  {p}
                </a>
              </span>
            ))}
          </p>
          <p className="mt-3">© {new Date().getFullYear()} Zen-Z</p>
        </address>
      </div>
    </footer>
  );
}
