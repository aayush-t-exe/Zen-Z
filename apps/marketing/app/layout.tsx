import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import SiteHeader from '@/components/site/header';
import SiteFooter from '@/components/site/footer';
import SiteBehavior from '@/components/site/site-behavior';
import { links, operator, site } from '@/lib/site';
import './globals.css';

// Archivo for display (the portfolio's face), Fraunces italic and Instrument
// Sans from the app itself, Caveat for the handwritten margin notes only.
// All four are self-hosted, trimmed copies (assets/fonts, OFL): only the
// weights and widths this site uses, Latin plus ₹ and curly quotes, which
// takes Archivo from 88 kB to 36 kB. size-adjusted fallbacks keep text still
// while they load.
const archivo = localFont({
  src: '../assets/fonts/archivo.woff2',
  weight: '600 900',
  declarations: [{ prop: 'font-stretch', value: '100% 115%' }],
  variable: '--font-archivo',
  display: 'swap',
  adjustFontFallback: 'Arial',
});
const instrument = localFont({
  src: '../assets/fonts/instrument-sans.woff2',
  weight: '400 700',
  variable: '--font-instrument',
  display: 'swap',
  adjustFontFallback: 'Arial',
});
// Accent words only (SemiBold Italic, SOFT 100); not worth competing with the first paint for.
const fraunces = localFont({
  src: '../assets/fonts/fraunces-italic.woff2',
  weight: '600',
  style: 'italic',
  variable: '--font-fraunces',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});
// SemiBold, basic Latin plus curly quotes and dashes, kerning and ligatures
// only: 18 kB instead of Google's 51 kB. (Dropped: the contextual alternates
// that vary doubled letters, which were most of the file.)
const caveat = localFont({
  src: '../assets/fonts/caveat.woff2',
  weight: '600',
  variable: '--font-caveat',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Arial',
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
