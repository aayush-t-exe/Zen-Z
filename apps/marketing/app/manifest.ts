import type { MetadataRoute } from 'next';

// The marketing site's manifest. The installable app itself is the web build
// at zen-z-app.vercel.app (see /get-app); this only makes the site's own
// icon and colours right when it's saved or shared.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zen-Z',
    short_name: 'Zen-Z',
    description:
      'Pick a plan, answer a few questions, and we put you at a table of students you haven’t met. Live at JNU Jaipur.',
    start_url: '/',
    display: 'standalone',
    background_color: '#E9E3D5',
    theme_color: '#E9E3D5',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
