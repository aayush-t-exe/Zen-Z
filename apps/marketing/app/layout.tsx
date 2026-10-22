import type { Metadata, Viewport } from 'next';
import { Archivo, Caveat, Fraunces, Instrument_Sans } from 'next/font/google';
import SiteHeader from '@/components/site/header';
import SiteFooter from '@/components/site/footer';
import SiteBehavior from '@/components/site/site-behavior';
import { links, operator, site } from '@/lib/site';
import './globals.css';

// Archivo for display (the portfolio's face), Fraunces italic and Instrument
// Sans from the app itself, Caveat for the handwritten margin notes only.
// Self-hosted by next/font with size-adjusted fallbacks, so nothing shifts.
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
});
const instrument = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['italic'],
  axes: ['SOFT', 'WONK'],
  variable: '--font-fraunces',
  display: 'swap',
});
const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.title, template: '%s · Zen-Z' },
  description: site.description,
  applicationName: site.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: site.name,
    locale: 'en_IN',
    url: '/',
    title: site.title,
    description: site.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: site.title,
    description: site.description,
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: '#E9E3D5',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${site.url}/#org`,
      name: site.name,
      url: site.url,
      logo: `${site.url}/icon-512.png`,
      email: operator.email,
      sameAs: [links.instagram, links.play],
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'A-21, Anand Vihar, Railway Colony, Jagatpura',
        addressLocality: 'Jaipur',
        addressRegion: 'Rajasthan',
        postalCode: '302017',
        addressCountry: 'IN',
      },
    },
    {
      '@type': 'MobileApplication',
      name: site.name,
      operatingSystem: 'Android, iOS (web app)',
      applicationCategory: 'SocialNetworkingApplication',
      installUrl: links.play,
      downloadUrl: links.play,
      url: site.url,
      description: site.description,
      publisher: { '@id': `${site.url}/#org` },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    },
  ],
};

// Runs before paint: lets CSS hide [data-pop] content only when JS will reveal it.
const bootScript = `document.documentElement.classList.add('js')`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en-IN"
      className={`${archivo.variable} ${instrument.variable} ${fraunces.variable} ${caveat.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-fg"
        >
          Skip to content
        </a>
        <SiteHeader />
        <div id="main">{children}</div>
        <SiteFooter />
        <div className="grain" aria-hidden />
        <SiteBehavior />
      </body>
    </html>
  );
}
