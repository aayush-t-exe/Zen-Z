# Play Store submission — working reference

Status as of 2026-09-03. This is prep material to paste into Play Console,
not itself a policy document — verify the Data Safety section in particular
against Play's own definitions before submitting; misdeclaring it can carry
policy consequences and this draft is a best-effort mapping from
`apps/marketing/app/privacy/page.tsx`, not legal advice.

## Reviewer login (Sign in details) — required after the 2026-09-22 rejection

Google rejected version code 2 (`IN_APP_EXPERIENCE-8158`) because Zen-Z has
no password to give reviewers — auth is email OTP only, no exceptions (see
CLAUDE.md's auth rule). Google's own rejection text asked for exactly this:
"a dedicated test bypass ... that do[es] not require your account to be
linked to our testing devices."

**Current design (2026-09-22, replaces the earlier link-based tool):** the
review account has a fixed, reusable email+password pair. No separate
webpage to visit — Google types one email and one 6-digit code straight
into the app's existing sign-in screens, exactly like a real login. This
needed a small, tightly scoped app change (see below), unlike the earlier
version which touched no app code at all.

- `apps/mobile/src/constants/playReview.ts` — the one hardcoded review
  email, `teamzenz.reviewer@gmail.com` (the account already on file with
  Google from the 2026-09-22 rejection screenshot). Not a secret.
- `email-input.tsx` — for that one email, skips the real `signInWithOtp()`
  call (no code to send) and goes straight to the verification screen.
- `otp-verification.tsx` — for that one email, calls
  `supabase.auth.signInWithPassword()` instead of `verifyOtp()`. Every
  other email is completely unaffected — unchanged code path, unchanged
  behavior.
- `supabase/functions/play-review-set-password` — an admin-only function,
  never called by the app or by Google. Sets/rotates the fixed password on
  the review account. Reuses the same `PLAY_REVIEW_SECRET` as before.

Verified 2026-09-22 against prod directly (not just reasoned about): the
password logs in via the real `/auth/v1/token?grant_type=password`
endpoint and — unlike the old OTP-code approach — is **reusable**, not
single-use.

**Only you can do this part:**

1. This needs an app code change to actually reach the build Google
   reviews, which means an EAS Update to the **production** channel after
   this lands — `cd apps/mobile && eas update --channel production` (needs
   an interactive `eas login`, can't be run here). Do this before
   resubmitting, or Google will still be testing the old code.
2. Set/rotate the password (only needed once, or if you want to change
   it):
   ```
   supabase functions deploy play-review-set-password --project-ref hzydzyeyvfuokveujbki
   curl -X POST "https://hzydzyeyvfuokveujbki.supabase.co/functions/v1/play-review-set-password?secret=<PLAY_REVIEW_SECRET>&password=<six digits>"
   ```
3. Paste this into Play Console's **Sign in details** declaration ("Some
   or all functionality is restricted" → app access instructions):

   > This app uses email sign-in. To review it:
   > 1. Open the app and enter this email address on the sign-in screen:
   >    teamzenz.reviewer@gmail.com
   > 2. On the next screen, enter this code: `<six digits>`
   >
   > That's the complete sign-in — no email inbox access is needed.

4. Do one real end-to-end check yourself (any device) after the EAS
   Update lands — confirm the app actually shows the new code path before
   submitting, since an OTA update only takes effect once the installed
   app has checked for and applied it.

This still doesn't need a new APK/AAB upload — the EAS Update patches the
JS bundle of the build Google already has, and this is otherwise a Play
Console metadata change only. Google re-reviews the whole app on any
resubmission, not just the changed field.

`supabase/functions/play-review-code` (the earlier link-based tool) is
still deployed but no longer referenced by these instructions — safe to
leave running unused, or remove it later if you want one less thing
around.

## Blocking — only you can do these

1. **Google Play Console developer account.** Created at
   play.google.com/console. Needs a real person's government ID for
   verification and a one-time $25 registration fee. Can take up to a
   few days to verify. Nothing else below can actually be submitted until
   this exists.
2. **Package id + Firebase.** `app.json`'s Android package is being
   changed from `com.campussocial.app` to a Zen-Z-branded id (recommend
   `com.zenz.app`) — this is a one-time-only decision, permanent after
   the first Play Store upload. Push notifications on Android go through
   Firebase Cloud Messaging, keyed to `google-services.json`, which is
   itself tied to a package name — so this isn't just an `app.json` edit:
   - Open the Firebase project backing `google-services.json` (Firebase
     console → look for a project containing an Android app registered
     as `com.campussocial.app`).
   - Add a new Android app in that same project with package name
     `com.zenz.app`.
   - Download the new `google-services.json` and hand it to me (or
     replace `apps/mobile/google-services.json` yourself).
   - I'll then update `app.json`'s `android.package` and
     `ios.bundleIdentifier` to match in the same change, so nothing goes
     out half-migrated.
   Until this happens, the app still builds and runs fine under the old
   package id — this only needs to land before the actual Play Store
   upload, not before further friend testing.

## Already done

- **Privacy policy** — live at zen-z.site/privacy, dated 2026-09-01,
  genuinely comprehensive (data collected, chat privacy, photo handling,
  service providers, retention, 18+ gating, contact). Play Console will
  ask for this URL directly — use `https://zen-z.site/privacy`.
- **In-app account deletion** — already built (`delete_own_account`
  RPC + mobile UI). Satisfies Play's Account Deletion policy, which
  requires both an in-app path and a web-reachable one; the privacy
  policy's contact email covers the web-reachable requirement.
- **18+ enforcement** — server-side (`profiles_date_of_birth_min_age`
  constraint), not just a UI checkbox. Relevant to the target-audience
  and content-rating sections below.
- **App icon** — `assets/images/icon.png`, 1024x1024, ready to use as-is
  for Play's 512x512 icon requirement.
- **Display name** — fixed this session: `app.json`'s `name` is now
  "Zen-Z" (was the scaffold default "mobile").

## Still needed — assets

- **Feature graphic** (1024x500 banner, required). Nothing exists yet.
  Say the word and I'll design one from the existing Zen-Z brand mark/
  palette rather than you needing a separate design pass.
- **Phone screenshots** (2–8, Play recommends at least 4). None exist
  yet. These need to come from the actual running app — I can capture
  these via the same Expo-web + headless-Edge pipeline already used for
  UI verification this session, once you confirm which screens you want
  featured (Home, Match Reveal, Group Chat, and the Personality Quiz are
  the obvious ones given the product's own pitch).

## Store listing copy (rewritten 2026-09-06 to match the Content Constitution's
honest/observational voice, approved 2026-09-05 — this supersedes the original
draft below, which used the older mysterious/invitation tone that's now
retired for anything outside in-app microcopy)

**Short description** (80 char max):
> You have friends. You just haven't found your people here yet.
(62 chars)

**Full description** (4000 char max):
> You have friends. You just haven't found your people here yet.
>
> Everyone around you seems fine. You've got a group, you sit with them
> every day. But nobody's into the one specific thing you actually love,
> so you end up going alone, or you just don't go. And honestly, not much
> happens around here anyway.
>
> Zen-Z is a once-a-week table for people in exactly that spot.
>
> Here's how it works. You answer a short quiz, not a dating profile. A
> real person reads it and builds your group of four strangers by hand.
> No algorithm, no swiping, no browsing, no picking who you sit with.
>
> Choose a Cafe, a Dinner, a Movie, or a sport slot when one's running:
> cricket, football, pool, pickleball. Your photo is seen only by the
> person building your table, never by the people you're matched with.
> You don't pick the venue either. That gets revealed once your evening
> is locked in.
>
> Ask for a men-only, women-only, or mixed group. If you don't want to
> walk in alone, bring a +1.
>
> A movie night is Rs 126, nothing more to pay. Eight-ball is Rs 70 an
> hour. If your group falls through, you get a full refund and your next
> evening is free.
>
> This isn't a dating app. There's nobody to swipe on and no profiles to
> browse. Just people who happen to be into the same specific things you
> are, and haven't sat across from you yet.
>
> One evening. Four strangers. A table somebody actually built for you.

**Category:** Social

**Contact email:** teamzenz003@gmail.com

**Privacy policy URL:** https://zen-z.site/privacy

## Content rating questionnaire — guidance, not answers

Google's IARC questionnaire computes the actual rating from how you answer
a series of yes/no content questions — I can't fill it out on your behalf
since it's interactive in-console, but based on what the app actually
does:
- User-generated content / user interaction: **yes** (group chat) — this
  alone typically pushes the rating up from "Everyone."
- Alcohol/drugs reference: Cafés and Dinners happen at real venues that
  may serve alcohol, but the app itself never depicts, sells, or
  promotes it — answer based on what the app shows, not the venue.
- No ads, no in-app purchases beyond the booking payment itself.
- Given the 18+ gate and real-world stranger meetups, expect something
  in the "Mature 17+" / "PEGI 16" range — don't be surprised by that, it
  reflects the product honestly rather than something to minimize in the
  questionnaire.

## Target audience

Set the target age group to **18 and older only** — do not include any
under-18 age bracket, consistent with the enforced minimum age. This also
keeps the app out of Play's stricter Families/child-safety policy path.

## Data Safety form — draft mapping (verify against Play's definitions before submitting)

| Category | Collected? | Notes |
|---|---|---|
| Name | Yes | Account/profile |
| Email address | Yes | Account, OTP auth |
| Phone number | Yes | WhatsApp contact, event-day coordination only — never shown to other members, never used for login |
| User IDs | Yes | Internal account identifiers |
| Photos | Yes | Profile photo — never shown to other students under any circumstance; used for internal verification only |
| Messages | Yes | Group chat content — private between group members, not routinely read by Zen-Z (see privacy policy §4) |
| Financial info | Yes | PayU payment/order identifiers and payment status — not raw card/UPI/bank credentials, those never touch Zen-Z's database |
| App activity | Yes | Booking, group, and referral activity |
| App info and performance | Yes | Crash/diagnostic data via Sentry |
| Location | **No** | Not collected — no location/venue picker exists anywhere in the booking flow by design |

**Data sharing:** Supabase (backend/storage), PayU (payments), Brevo
(OTP email), Expo (push notifications) are service providers processing
data to run the app, not third parties it's sold or shared to for their
own purposes — Play's form distinguishes these, so this typically does
**not** count as "sharing" under their definition, but confirm this
reading against Play's current help docs before answering, since Play's
exact line between "processor" and "shared" has shifted before.

**Data deletion:** Yes — in-app self-service (delete_own_account) plus
the privacy policy's contact-email path.

## Release track recommendation

Don't go straight to a public Production release. Use **Internal
testing** (up to 100 testers, no review wait, live within minutes) for
your 9 friends first, then **Closed testing** if you want a longer beta
before Production. Production is the only track subject to Google's
full review process and the one that's actually publicly listed/
searchable on the Play Store.
