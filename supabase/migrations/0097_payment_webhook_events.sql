-- ============================================
-- 0097_payment_webhook_events.sql
-- payu-webhook (index.ts) has never logged anything about its own
-- invocations anywhere queryable — 2026-09-16's incident (a real paid
-- booking stuck at payment_status='unpaid') could only be diagnosed by
-- reading bookings rows after the fact, with no way to tell whether PayU
-- ever actually called the webhook at all, or called it and hit a
-- rejected/failed path. This table makes every future incident answerable
-- with a query instead of a guess: was this a PayU delivery problem or an
-- our-side processing problem.
--
-- One row per webhook POST, regardless of outcome — including rejected
-- (bad signature) and ignored (non-success status) calls, not just the
-- ones that update a booking. raw_body is kept for forensic value: it's
-- the only place PayU's actual payload survives past a single request.
--
-- No FK to bookings (booking_id) — same reasoning create-payment-order's
-- udf1 correlation already uses: PayU's own payload is untrusted input at
-- the point this row is written, and a garbled/forged delivery must still
-- be logged, not rejected by a constraint before we can see it.
-- ============================================

create table payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  signature_valid boolean not null,
  booking_id text,
  payu_status text,
  txnid text,
  mihpayid text,
  outcome text not null,
  raw_body text not null
);

alter table payment_webhook_events enable row level security;

-- Only the service role writes here (the webhook uses
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely) — this policy
-- is read-only visibility for the founder to diagnose a stuck payment
-- without needing Supabase dashboard log access.
create policy "admins read payment webhook events" on payment_webhook_events
  for select using (exists (select 1 from admin_users where id = auth.uid()));
