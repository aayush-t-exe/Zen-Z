import type { MetadataRoute } from 'next';

const BASE = 'https://zen-z.site';

// Public pages only. /get-app and /payment-redirect are route handlers, not pages.
const pages: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/refund', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/community-guidelines', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/delete-account', priority: 0.3, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return pages.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE}${path === '/' ? '' : path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
