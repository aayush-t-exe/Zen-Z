import Link from 'next/link';

const topLinks = [
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

const footerLinks = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/refund', label: 'Refunds' },
  { href: '/community-guidelines', label: 'Community Guidelines' },
];

export default function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 pt-10 text-sm">
        <Link href="/" className="font-medium text-violet-100/80">
          Zen-Z
        </Link>
        <nav className="flex flex-wrap gap-5 text-violet-100/50">
          {topLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-violet-100/80">
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="mx-auto flex max-w-3xl flex-col px-6 pb-8 pt-16 sm:pt-20">
        <span className="text-sm uppercase tracking-[0.3em] text-violet-300/70">Legal</span>
        <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-sm text-violet-100/50">Last updated {updated}</p>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="legal-body flex flex-col gap-10 text-sm leading-relaxed text-violet-100/70">
          {children}
        </div>
      </section>

      <footer className="mx-auto max-w-3xl px-6 py-16 text-center text-sm text-violet-100/40">
        <p className="font-medium text-violet-100/60">Zen-Z</p>
        <p className="mt-2">Operated by Dhruv Goyal &middot; Individual / unregistered project</p>
        <p className="mt-1">A-21, Anand Vihar, Railway Colony, Jagatpura, Jaipur, Rajasthan &ndash; 302017, India</p>
        <p className="mt-1">
          <a href="mailto:teamzenz003@gmail.com" className="hover:text-violet-100/70">
            teamzenz003@gmail.com
          </a>{' '}
          &middot; 9460623157 &middot; 7069183086
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-violet-100/70">
              {link.label}
            </Link>
          ))}
        </div>
      </footer>
    </main>
  );
}
