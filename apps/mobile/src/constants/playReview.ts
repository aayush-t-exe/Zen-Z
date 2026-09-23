// One fixed account for Google Play reviewers to sign into, since Zen-Z's
// real auth is email-OTP-only and Google can't complete an OTP flow
// themselves (no inbox access) — see docs/PLAY_STORE_SUBMISSION.md. This
// email is not a secret; it's already been shared with Google directly.
// The account's *password* (set via supabase/functions/play-review-set-password,
// not stored here) is what actually gates access — never add real users'
// accounts to a password-based path, this branch only ever matches this
// one exact address.
export const PLAY_REVIEW_EMAIL = 'teamzenz.reviewer@gmail.com';
