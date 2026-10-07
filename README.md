<p align="center">
  <img src="docs/store-assets/feature-graphic.png" alt="Zen-Z" width="720">
</p>

# Zen-Z

A campus social app that puts four or five strangers at the same table. A
student books a weekly slot (a café, a dinner, a movie or a sports game),
takes a short personality quiz, and a human matches them into a small group
by interests and personality. The group gets a chat, a venue, and a time.

I built Zen-Z from scratch, starting in July 2026, as the founder and only
engineer: the Android app, the admin dashboard the matching team worked
from, the marketing site, and the whole Supabase backend. It went out on
Google Play and launched to students at Jaipur National University on
24 September 2026.

## What's in this repo

| Path | What it is |
| --- | --- |
| `apps/mobile` | Student app. Expo, React Native, TypeScript, Expo Router, NativeWind, Zustand, TanStack Query |
| `apps/admin` | Matching and operations dashboard. Next.js App Router, Tailwind, shadcn/ui, @dnd-kit drag-and-drop matching board |
| `apps/marketing` | Public site with pricing, FAQ, legal pages and the PayU redirect page. Next.js |
| `supabase/migrations` | About 100 SQL migrations: schema, row-level security, RPCs, triggers, storage policies |
| `supabase/functions` | Deno Edge Functions: PayU order creation and webhook, personality scoring, push notifications, account deletion |
| `supabase/tests` | pgTAP tests for the security-critical database rules |
| `docs/` | Product spec, architecture decisions, milestone plan, deployment notes |

## How it works

1. **Sign in** with an email one-time code. No passwords and no phone auth.
2. **Profile and quiz.** Students build a profile and answer a personality
   quiz. The quiz is entirely data-driven: questions, options, scoring weights
   and scale mappings all live in Postgres tables, so adding a question is an
   insert, not a release. The `score-personality` Edge Function turns answers
   into trait scores.
3. **Book a slot.** Cafés and dinners are free to book. Movies and sports are
   paid through PayU. There is no venue picker; the venue is assigned after
   matching.
4. **Matching.** The team drags students between candidate groups on the
   admin board, using quiz scores, interests and budget, then confirms the
   group and assigns a venue.
5. **Meet.** The group sees each other's first names and interests, chats in
   real time (Supabase Realtime), and gets push reminders before the slot.

## Engineering highlights

**Photo privacy enforced in the database, not the UI.** Students upload a
profile photo, but only the matching team ever sees it. A student never sees
another student's photo. This holds at three layers: RLS on `profiles`, a
groupmate view that has no `photo_url` column, and a private storage bucket
whose policy only admits admins. A pgTAP test
(`supabase/tests/database/001_photo_privacy.sql`) checks it against the real
policies.

**Payments the client can't fake.** PayU orders are created server-side in
an Edge Function that prices the booking itself, so the app never sends an
amount. A booking only becomes paid when PayU's webhook arrives with a hash
that verifies against the merchant salt. Every webhook is logged, and the
admin dashboard has a "Needs attention" panel for payments that got stuck
between the two.

**Security as tests.** The pgTAP suite covers row-level security and RPC
permission boundaries: photo privacy, group reveal gates, no-show blocking,
account deletion, report and message integrity, admin-only functions, and a
regression test that internal `SECURITY DEFINER` functions are not callable
by the `anon` or `authenticated` roles.

**CI on every push.** GitHub Actions runs lint, typecheck and unit tests for
all three apps, Vitest for the Edge Function logic, a production build of
the admin app, and the pgTAP suite against the dev database. The pgTAP job
is serialised with a concurrency group, since runs share one database.

**Two environments, schema in code.** Separate dev and prod Supabase
projects. Every schema change is a migration file in this repo, never a
dashboard edit. The mobile app ships over-the-air updates with EAS Update.

**Privacy decisions written down.** The admin dashboard never displays group
chat messages, including in the reports queue. `docs/ARCHITECTURE.md` explains
why that is a policy decision rather than an RLS guarantee, and why
end-to-end encryption was considered and rejected.

## Running it locally

Requires Node 22 and two Supabase projects (or one, for a quick look).

```bash
npm install

# Copy the env templates and fill in your Supabase URL and anon key
cp apps/mobile/.env.example apps/mobile/.env
cp apps/admin/.env.local.example apps/admin/.env.local

# Apply the schema
npx supabase link --project-ref <your-project-ref>
npx supabase db push

npm run mobile      # Expo dev server
npm run admin       # admin dashboard on localhost:3000

npm run test:functions   # Edge Function unit tests
npm run test:db          # pgTAP, against the linked project
```

Payments need PayU credentials set as Edge Function secrets
(`PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT`, `PAYU_MERCHANT_ID`,
`PAYU_CLIENT_ID`, `PAYU_CLIENT_SECRET`, `PAYU_API_BASE_URL`,
`PAYU_OAUTH_TOKEN_URL`) via `npx supabase secrets set`.

## Docs

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md): every screen, table and rule
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): the technical decisions and the reasons behind them
- [`docs/MILESTONES.md`](docs/MILESTONES.md): the milestone-by-milestone build plan
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): environments, secrets and release steps

## Author

Aayush Thakur, B.Tech CSE at Jaipur National University.
[LinkedIn](https://www.linkedin.com/in/aayush-thakur-5b0734326)
