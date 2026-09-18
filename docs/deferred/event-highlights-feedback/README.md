# Deferred: event-highlights feedback (photo/clip submission)

**Status:** Parked 2026-09-18, per founder call. Not building this in the
current update — do not resume without the founder explicitly reopening it.
Reverted with `supabase/migrations/0099_revert_event_highlights_feedback.sql`.

## What this was

A post-event feedback screen for students: star rating, "would you do this
again?", a free-text private note, and an *optional* photo/clip from the
event that the founder could review and repost on `@zen_z.app`. The
`post_event_feedback` push notification ("How did your story end tonight?")
has fired since `0019_notifications.sql`, but no screen ever existed behind
it — this was that screen, plus the backend/admin side to review submissions.

This is **not** the founder-only profile-photo feature and does not touch
`profiles.photo_url` or its RLS/view/bucket protections — it's a separate,
student-submitted, founder-reviewed-before-posting photo, same private-by-
default posture as profile photos (see `docs/ARCHITECTURE.md` "Photo
privacy"). Any future work here should keep that separation clear.

## What was actually built, and how far it got

- **Shipped and later reverted** (commit `98ae0a7`, reverted by `0099`):
  - `feedback.media_path` / `feedback.media_consent` columns +
    `feedback_media_consent_required` constraint (hard DB backstop — a
    `media_path` can never be stored without `media_consent = true`, because
    a submitted photo very likely includes groupmates who never consented
    themselves; the checkbox is only the submitter attesting for themselves,
    not a verified guarantee — founder accepted that tradeoff 2026-09-14).
  - Private `event-highlights` storage bucket + policies (student can upload
    to their own booking's folder, admin can read).
  - Admin `/feedback` review page (rating, would-repeat, note, signed-URL
    media preview) and its nav card on the admin home screen.
  - A pgTAP test for the consent constraint.
  - Full original code for these three is still in git history at `98ae0a7`
    (`git show 98ae0a7`); copies of the SQL/page also saved alongside this
    README (`0090_event_highlights_feedback.sql.txt`,
    `018_feedback_media_consent.sql.txt`, `admin-feedback-page.tsx`) since a
    future rebuild will likely start from these rather than re-deriving them.

- **Built but never committed** (mobile screen — this is the part that would
  otherwise have been lost, since it never made it into git history):
  - `mobile-feedback-screen.tsx` — the actual student-facing screen at
    `apps/(flow)/feedback.tsx`: star rating, would-repeat chips, optional
    note, optional photo/video attach via `expo-image-picker`
    (`expo-file-system`'s `File` API for video, since picker doesn't return
    base64 for video and `fetch(uri).blob()` was already known-unreliable on
    native from `profile-creation.tsx`'s photo upload), consent checkbox
    gating the upload, then a "thanks" screen with rate-the-app / follow-
    Instagram prompts.
  - `mobile-social-actions.ts` — `requestAppReview()` (native store-review
    prompt via `expo-store-review`, falling back to opening the store
    listing directly since the native module may not be compiled into
    whatever build is currently installed) and `followInstagram()`. Written
    to be shared with `profile.tsx`'s existing "Rate the app" button
    eventually, but that refactor was never done — `profile.tsx` still has
    its own inline copy.
  - `mobile-wiring.patch` — the notification-routing change
    (`notifications.ts` routing a `post_event_feedback` tap to
    `/(flow)/feedback` instead of falling back to the Bookings tab) plus the
    `expo-file-system` / `expo-store-review` package.json additions. This
    has been reverted from the working tree.

## What's still missing for a real rebuild

- The mobile screen needs a fresh EAS build regardless (new native modules:
  `expo-file-system`, `expo-store-review`) — same constraint the original
  commit message noted.
- No re-verification that `expo-store-review`'s native module is actually
  compiled into the build it ships in (the code defends against this, but
  it was never tested on a real device).
- The `Stack.Screen name="feedback"` route entry in
  `apps/mobile/src/app/(flow)/_layout.tsx` was left in place (added earlier,
  alongside unrelated `whats-next` work) — it's inert without the
  notification-routing change and the screen file, so nothing needed
  reverting there, but a rebuild can reuse it as-is.
- Nothing about admin moderation of submitted photos before they're posted
  publicly beyond "founder eyeballs it in the admin page" — worth deciding
  explicitly if this comes back, especially given the media-consent
  tradeoff already accepted.
