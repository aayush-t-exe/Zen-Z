import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/payment-redirect'] }],
    sitemap: 'https://zen-z.site/sitemap.xml',
    host: 'https://zen-z.site',
  };
}
