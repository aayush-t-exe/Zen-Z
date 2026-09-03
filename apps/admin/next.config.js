const { withSentryConfig } = require('@sentry/nextjs/config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    isrMemoryCacheSize: 0,
  },
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
  },
};

// Sourcemap upload only fires when SENTRY_AUTH_TOKEN is set (a later,
// separate step once there's a Sentry project + auth token to add as a
// Vercel env var) — without it this just skips the upload silently and
// the build still succeeds, same as omitting the wrapper entirely.
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
