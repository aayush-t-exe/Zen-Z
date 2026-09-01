# Known issues backlog

Found during two audits on 2026-08-25 (a security-focused pass, then a
broader correctness/UX/ops pass after being asked "is that really it").
This is a deliberately parked list to work through once the app itself is
feature-complete. Check them off as they're addressed; delete a line once
it's actually fixed rather than leaving a stale checkbox.

Updated 2026-09-01 during a pre-Play-Store testing pass: this file had gone
stale — the former "High — real money exposure" section (cancel/payment race,
CI admin build gate) had already been fixed by `docs/TESTING_CHECKLIST.md`'s
Area 5 audit and this same pass respectively, both now removed rather than
left as stale checkboxes. The three former "Medium — real UX bugs" items (no
error boundary, home/sports-select screens swallowing fetch errors, chat
messages vanishing on send failure) were confirmed still open and fixed in
this same pass — see git history around 2026-09-01 for the actual changes.

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
- PayU webhook signature verification is correct (HMAC, verify-before-parse).
- Automated tests exist and run in CI for the two highest-risk flows:
  `supabase/functions/payu-webhook/logic.test.ts` and
  `supabase/tests/database/*.sql` (pgTAP, RLS/photo-privacy/confirm-group/
  reveal-gate/no-show-block).
