import * as Sentry from '@sentry/react-native';

// EXPO_PUBLIC_SENTRY_DSN is unset until a Sentry project exists for this
// app — init is skipped rather than passing an empty dsn, so local/dev
// runs and CI stay silent instead of erroring or phoning home nowhere.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
  });
}

export { Sentry };
