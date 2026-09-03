import * as Sentry from '@sentry/nextjs';

// NEXT_PUBLIC_SENTRY_DSN is unset until a Sentry project exists for this
// app — init is skipped rather than passing an empty dsn, so local dev,
// CI, and any build missing the var stay silent instead of erroring.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
  });
}
