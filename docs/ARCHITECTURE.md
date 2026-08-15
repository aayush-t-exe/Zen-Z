# Architecture decisions (Milestone 1 — locked)

This is the record of every "multiple approaches existed, here's what we
picked and why" decision made before any code was written. Treat these as
settled unless the founder explicitly reopens one.

## Auth architecture
Supabase Auth natively supports phone OTP and email OTP as independent
sign-in methods on the same project.

| Decision | Choice | Why |
|---|---|---|
| Email delivery | 6-digit OTP code, not magic link | Magic links deep-link back into the app, which is finicky in Expo (cold-start handling, in-app browser interception). A code means phone and email share one input screen. |
| Identity linking | Exactly one method per user, never both required | No merge logic, no "add a backup method" flow. |
| Profile creation | Postgres trigger (`handle_new_user()` on `auth.users` insert), not app-side code | Keeps every other table's foreign keys uniform regardless of which auth method a user picked — nothing downstream needs to know or care. |

**Schema delta this forces** (apply as the first migration, not a rewrite of
the rest of the schema in docs/PRODUCT_SPEC.md):
```sql
alter table profiles alter column email drop not null;
alter table profiles add column phone text;
alter table profiles add constraint profiles_identity_check
  check (email is not null or phone is not null);
```
No RLS policy changes are needed — existing policies key off `auth.uid() = id`,
never off email specifically.

## Provider decisions

| Decision | Options considered | Choice | Why |
|---|---|---|---|
| SMS/phone OTP | Twilio vs. MSG91 | MSG91 | Better Indian carrier deliverability, and built around India's DLT compliance requirement (see below) — Twilio leaves that entirely on you. |
| Email OTP delivery | Supabase default vs. custom SMTP | Brevo | Supabase's built-in email sending is rate-limited, not production-grade. Switched from an initial Resend pick (Milestone 20) — Brevo's free tier allows 300 emails/day vs. Resend's 100/day. |
| Monorepo tooling | npm workspaces vs. pnpm vs. Turborepo/Nx | npm workspaces | Ships with Node, no extra tool to learn. Can graduate to Turborepo later without restructuring if build times become a problem. |
| Mobile navigation | Expo Router vs. React Navigation directly | Expo Router | File-based routing, automatic deep linking (relevant to the OTP flow). |
| Styling | NativeWind/Tailwind vs. StyleSheet vs. Tamagui | NativeWind (mobile) + Tailwind (admin) | One mental model across both apps; also what Claude Code generates most reliably. |
| Admin UI kit | shadcn/ui vs. MUI vs. custom | shadcn/ui | Plain React + Tailwind under the hood, no separate theming system to fight with the custom matching board. |
| Drag-and-drop | @dnd-kit/core vs. react-beautiful-dnd | @dnd-kit/core | react-beautiful-dnd is unmaintained. |
| Matching engine execution | Edge Function vs. separate backend service | Edge Function | The scoring logic is a lightweight computation, not a service with its own scaling needs. |
| Environments | 2 Supabase projects vs. 3 | 2 (dev, prod) | Staging earns its keep once there's a team/release process to protect. Easy to add later. |
| Error tracking | Sentry vs. none | Sentry, both apps | Free tier is enough at this scale. |
| CI | GitHub Actions | GitHub Actions | Lint + typecheck + test on every PR; EAS/Vercel handle their own deploy pipelines. |
| React version (admin + marketing) | Stay on React 18 vs. move to 19 | React 19.2.3+ | Milestone 20 surfaced a real bug: CI never ran an actual `next build` (only lint/typecheck/test), so a monorepo hoisting conflict went undetected — `apps/mobile` needs React 19 (Expo's requirement), which got hoisted to the repo root, while `apps/admin` pinned React 18 nested separately; Next's own internal pages (`/404`, `/_error`) always resolve `react` from the root, so they silently loaded a *different* React copy than the app code, crashing any production build. Fix: unify the whole repo on React 19 rather than fight npm's hoisting. Also fixed in the same pass: `@expo/vector-icons` (mobile-only, used by `apps/mobile/src/components/tab-bar-icon.tsx`) had been declared as a root-level dependency instead of a mobile one — that's what was dragging `react-native` into the root's own resolution in the first place. |

## Photo privacy (enforced at three layers, not just UI)
1. RLS on `profiles`: a student can only `select` their own full row (including
   `photo_url`). Admins can select all rows.
2. A `group_member_public` view (no `photo_url` column) is the *only* thing
   the mobile app queries for groupmate info — so there is no code path, buggy
   or otherwise, that can leak a photo to another student.
3. Storage bucket `profile-photos` is private; RLS policies on
   `storage.objects` restrict read access to the uploading user's own folder
   and admins only.

## India SMS compliance — DLT registration (start this immediately)
Since 2020, TRAI requires any business sending SMS to Indian numbers —
including OTP — to register on a DLT (Distributed Ledger Technology) platform,
or telecom operators silently block the messages. Three phases, done in
order:

| Phase | Typical turnaround |
|---|---|
| Entity registration | 2-7 business days |
| Sender ID / header registration | 1-3 business days |
| Message template registration (exact OTP wording) | 1-3 business days |

Budget 1-2 weeks end to end. Register OTP templates under "Service Implicit,"
not "Transactional" (that category is effectively reserved for banks now —
getting this wrong causes silent delivery failures). MSG91 offers DLT
registration assistance as part of onboarding — start that conversation
early, well before the Auth milestone needs it working.

**Other lead-time items worth starting in parallel, not when the relevant
milestone arrives:** Razorpay business KYC, Apple Developer Program
enrollment, Google Play Console account setup, Brevo account + domain
verification.

## Finalized dependency stack
```
Mobile:  expo, expo-router, react-native, typescript,
         @supabase/supabase-js, nativewind, tailwindcss,
         zustand, @tanstack/react-query, expo-notifications

Admin:   next, typescript, @supabase/supabase-js, tailwindcss,
         shadcn/ui (via CLI), @dnd-kit/core, @tanstack/react-query

Shared:  zod (validated shared types between both apps)

Backend: Supabase CLI, Deno (Edge Functions runtime, bundled with the CLI)
```

## Finalized folder structure
```
/campus-social
├── apps/
│   ├── mobile/          # Expo Router app
│   └── admin/            # Next.js App Router admin dashboard
├── supabase/
│   ├── migrations/       # SQL migrations
│   ├── functions/         # Edge Functions
│   └── seed.sql
├── packages/
│   └── shared/             # zod schemas, shared TS types, scoring logic
├── docs/                    # this folder
├── CLAUDE.md
└── .github/workflows/        # CI: lint, typecheck, test on every PR
```
