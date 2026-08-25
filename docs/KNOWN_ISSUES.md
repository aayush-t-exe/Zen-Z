# Known issues backlog

Found during two audits on 2026-08-25 (a security-focused pass, then a
broader correctness/UX/ops pass after being asked "is that really it").
Nothing here is fixed yet — this is a deliberately parked list to work
through once the app itself is feature-complete. Check them off as they're
addressed; delete a line once it's actually fixed rather than leaving a
stale checkbox.

## High — real money exposure

- [ ] **Cancel/payment race lets a cancelled booking still get marked paid.**
      `create-payment-order` (`supabase/functions/create-payment-order/index.ts:58-88`)
      only checks booking ownership, never status. `razorpay-webhook`
      (`index.ts:44-47`) unconditionally sets `payment_status='paid'` by
      booking id with no status guard. If a student cancels a booking after
      opening Razorpay checkout but completes payment anyway (or the webhook
      is delayed), the booking ends up `cancelled` **and** `paid` — money
      captured, no refund triggered, invisible to `confirm_group` since that
      requires `pending_match`.
      **Fix:** guard both the order-creation call and the webhook's UPDATE
      on the booking's current status.

- [ ] **CI doesn't run `next build` for `apps/admin`.**
      `.github/workflows/ci.yml` only runs lint + typecheck for admin — the
      same failure class as the React 19 hoisting incident already written
      up as a postmortem in `docs/ARCHITECTURE.md`. A change can pass CI and
      still fail to build in production.
      **Fix:** add a `next build` step to CI for `apps/admin`, gating merge.

## Medium — real UX bugs

- [ ] **No top-level React error boundary in the mobile app.** Any
      render-time exception (null field, unexpected API shape) white-screens
      the entire app with no recovery UI.

- [ ] **Home screen and booking screen silently swallow fetch errors.**
      `apps/mobile/src/app/(home)/index.tsx:50-76` and
      `booking-flow.tsx:196-250` destructure only `{ data }` from Supabase
      calls, never check `{ error }`. A failed query renders as an empty
      state ("no activities/slots available") instead of an error + retry —
      indistinguishable from a real empty state.
      **Reference fix:** `payment.tsx` already does this correctly (checks
      errors, has a working retry UI) — copy that pattern.

- [ ] **Group chat messages can silently vanish on send failure.**
      `apps/mobile/src/app/(home)/group/[groupId].tsx:108-120` clears the
      input before the insert resolves, no optimistic UI; a failed insert is
      only `console.error`'d — the user sees their message disappear with no
      indication it wasn't sent.

## Medium — ops/observability gaps

- [ ] **Sentry was decided on (see `docs/ARCHITECTURE.md`) but never
      implemented.** Not in either app's `package.json`, no `Sentry.init`
      anywhere. Zero production error visibility beyond manually tailing
      Supabase function logs.

- [ ] **No uptime/health monitoring** for the Edge Functions or the admin
      site — nothing currently detects if either goes down.

## Low

- [ ] **No DB-level length/format constraints** on `messages.content`,
      `profiles.full_name`, `profiles.phone`. Not an injection risk (no XSS
      path found — React auto-escapes everywhere in `apps/admin`), but a
      direct PostgREST call bypassing client-side checks could store
      unbounded text and break layouts or bloat the DB.

## Already checked and solid (don't re-flag without new evidence)

- Founder-only photo privacy — verified at all three layers (RLS, the
  `group_member_public` view, private storage bucket policy).
- RLS is enabled on all 23 tables, no gaps found across 41 migrations.
- Booking cutoffs and no-show blocks are enforced server-side (RLS), not
  just client-side UI checks.
- Slot booking has no capacity race — by design, the founder splits
  bookings into groups after the fact rather than capping at insert time.
- `messages` RLS and Realtime subscriptions are correctly scoped per-group;
  no cross-user data leak found (message content, push tokens, reports).
- Razorpay webhook signature verification is correct (HMAC, verify-before-parse).
- Automated tests exist and run in CI for the two highest-risk flows:
  `supabase/functions/razorpay-webhook/logic.test.ts` and
  `supabase/tests/database/*.sql` (pgTAP, RLS/photo-privacy/confirm-group/
  reveal-gate/no-show-block).
