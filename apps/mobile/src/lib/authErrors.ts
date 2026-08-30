import type { AuthError } from '@supabase/supabase-js';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

// Only these codes get their own copy. Everything else — including
// `user_not_found` and `user_banned`, which would otherwise confirm
// whether an email is a registered (or deleted/banned) account — falls
// back to the one generic message, so error text can never be used to
// enumerate accounts.
const FRIENDLY_MESSAGES: Partial<Record<string, string>> = {
  over_email_send_rate_limit: "You've requested a few too many codes — please wait a bit before trying again.",
  over_request_rate_limit: 'Too many attempts. Please wait a bit before trying again.',
  otp_expired: "That code isn't right or has expired. Please try again.",
  invalid_credentials: "That code isn't right or has expired. Please try again.",
  email_address_invalid: "That doesn't look like a valid email.",
  validation_failed: "That doesn't look like a valid email.",
};

// Never surface a Supabase Auth error's raw `.message` directly in the UI —
// its wording varies by failure mode in ways that can hint at whether an
// email belongs to an existing account. Map known, safe-to-show codes to
// our own copy and fall back to one generic message for anything else.
export function getAuthErrorMessage(error: Pick<AuthError, 'code'> | Error | null | undefined): string {
  if (!error) return GENERIC_MESSAGE;
  const code = (error as Partial<AuthError>).code;
  if (code && FRIENDLY_MESSAGES[code]) {
    return FRIENDLY_MESSAGES[code]!;
  }
  return GENERIC_MESSAGE;
}
