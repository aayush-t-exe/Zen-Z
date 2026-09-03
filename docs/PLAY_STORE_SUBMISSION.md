# Play Store submission — working reference

Status as of 2026-09-03. This is prep material to paste into Play Console,
not itself a policy document — verify the Data Safety section in particular
against Play's own definitions before submitting; misdeclaring it can carry
policy consequences and this draft is a best-effort mapping from
`apps/marketing/app/privacy/page.tsx`, not legal advice.

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

## Store listing copy (draft — matches the established Zen-Z voice: no "book
now"/"confirm"/"slot"/"limited spots", no em dashes, no venue-picker
framing, no "verified students" claim)

**Short description** (80 char max):
> A weekly invitation into a story you didn't see coming.
(74 chars)

**Full description** (4000 char max):
> Every table has a story before anyone sits down.
>
> Zen-Z is a campus-first way to meet people you'd never have crossed
> paths with otherwise. No swiping. No browsing profiles. No choosing who
> to meet.
>
> Once a week, you're invited into a Café, Dinner, or Movie evening.
> You'll be placed into a small group of fellow students, matched using a
> short personality quiz, not a photo. Your group is revealed to you
> together. The where and when unlock as the evening gets closer.
>
> What Zen-Z is:
> - A once-a-week social invitation, not another dating app
> - Small groups of 4-5, matched on personality, not looks
> - A group chat to coordinate, once your evening is revealed
> - Built for one campus community at a time
>
> What Zen-Z isn't:
> - It's not for browsing or choosing who you meet
> - Your photo is never shown to anyone you're matched with, under any
>   circumstance
> - It's not a place to find a date
>
> Your invitation is sealed the moment you claim your evening. The story
> begins when your group is revealed.

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
