/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // AVIF first: the hero's stickers and screens come out 20 to 40% smaller than
  // WebP, and they're most of what a phone downloads before the first paint.
  images: { formats: ['image/avif', 'image/webp'] },
};

module.exports = nextConfig;
