# Project: Campus-first concierge social discovery app

Students book a fixed weekly slot (Café / Dinner / Movie), the founder manually
matches them into groups of 4-5 via an admin dashboard, students meet up.
Full detail lives in docs/ — this file is the high-signal summary read at the
start of every session. Read docs/PRODUCT_SPEC.md and docs/ARCHITECTURE.md
before touching anything you're unsure about; don't guess at product rules.

## Non-negotiable product rules (do not silently change these)
- **Founder-only profile photos.** No student ever sees another student's
  photo, under any circumstance. This is enforced at three layers, not just
  UI: RLS on `profiles`, a `photo_url`-free view for groupmate queries, and a
  private storage bucket policy. See docs/ARCHITECTURE.md "Photo privacy."
  Any change that could leak a photo to the mobile client is a bug, not a
  style choice — treat it as a security issue.
- **All three activities live from day one.** Cafés, Dinners, Movies are
  never gated, greyed out, or hidden — even though only one may be the
  operational focus at launch.
- **No location/venue field in the booking flow.** The founder assigns the
  venue after matching. Do not add an area/location picker to booking screens.
- **Personality quiz is fully data-driven.** Questions, options, and scoring
  weights live in `personality_questions` / `personality_question_options` /
  `personality_option_weights` / `personality_scale_mappings`. Never hardcode
  a question in frontend or backend code — adding question #6-15+ should be a
  data change only.
- **Tone is mysterious/adventurous**, not operational. Before writing any
  user-facing string, check docs/PRODUCT_SPEC.md's microcopy tables. Avoid
  copy like "Booking Confirmed" — prefer the established voice ("Your
  invitation is sealed").
- **Auth: phone OTP OR email OTP, user's choice, never both required.** No
  student ID, no student email domain check, no photo ID upload, no manual
  identity verification anywhere in the product.

## Stack (locked — do not deviate without asking first)
- Mobile: Expo + React Native + TypeScript + Expo Router + NativeWind +
  Zustand (local/UI state) + TanStack Query (server state)
- Admin: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui +
  @dnd-kit/core (matching board drag-and-drop)
- Backend: Supabase — Postgres + Auth + Storage + Realtime + Edge Functions
  (Deno runtime)
- Payments: Razorpay — server-side order creation + webhook verification.
  Never trust a client-reported "payment succeeded" state alone.
- SMS OTP: MSG91 (India, DLT-compliant) · Email OTP: Brevo (custom SMTP —
  do not rely on Supabase's default email sending in production)
- Monorepo: npm workspaces — `apps/mobile`, `apps/admin`, `packages/shared`,
  `supabase/`
- Matching engine: a Supabase Edge Function, not a separate backend service
- Environments: two Supabase projects only (dev, prod) — no staging tier yet

## Working agreement
- We work milestone by milestone — see docs/MILESTONES.md for the full list
  and current status. Confirm before jumping ahead to a milestone that
  hasn't been reached yet.
- No placeholder code, no TODOs left in anything considered "done."
- Every schema change is a file in `supabase/migrations/`, never a hand edit
  in the Supabase dashboard.
- If you're making an assumption the docs don't cover, say so explicitly
  (the existing docs use `[ASSUMPTION]` tags — keep using that convention)
  rather than silently picking one.
- RLS is enabled on every table by default. If you ever write a table
  without RLS, that's a stop-and-ask moment, not a "fix it later."
