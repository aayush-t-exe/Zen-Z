-- ============================================
-- 011_bookings_column_grants.sql
-- Milestone 19: Testing (Area 10 — cross-cutting RLS/service_role audit).
--
-- "own bookings insert" (0001_init.sql) only restricts *which* row a
-- student can create — RLS has no concept of column restriction, so a
-- direct insert with a valid session could set payment_status/payment_id
-- to anything, including 'paid', with no Razorpay payment ever made.
-- Verified live before the fix (a rolled-back insert with
-- payment_status='paid' succeeded); 0059_bookings_column_grants.sql closes
-- it with column-level GRANTs, mirroring 0051's fix for profiles. This
-- proves both that the exploit is now blocked, and that the legitimate
-- insert path (the exact columns booking-flow.tsx actually sends) still
-- works.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/011_bookings_column_grants.sql
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(2);

-- ---- fixtures ----
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000301', 'pgtap-bcg-a@test.local');

update profiles set full_name = 'BCG Student' where id = 'a1000000-0000-0000-0000-000000000301';

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90011, 'pgtap BCG Cafe', 2, 4);
insert into slots (id, activity_type_id, slot_datetime) values
  ('b1000000-0000-0000-0000-000000000301', 90011, now() + interval '5 days'),
  ('b1000000-0000-0000-0000-000000000302', 90011, now() + interval '5 days');

-- ---- simulate the student's own session ----
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000301', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$insert into bookings (id, user_id, slot_id, status, payment_status, budget_band, group_preference)
    values ('e1000000-0000-0000-0000-000000000301', 'a1000000-0000-0000-0000-000000000301',
      'b1000000-0000-0000-0000-000000000301', 'pending_match', 'paid', 'medium', 'mixed')$$,
  null, null,
  'a student can no longer self-insert a booking with payment_status=''paid'' — the free-matching exploit is closed'
);

insert into pgtap_output select lives_ok(
  $$insert into bookings (user_id, slot_id, status, budget_band, group_preference)
    values ('a1000000-0000-0000-0000-000000000301', 'b1000000-0000-0000-0000-000000000302', 'pending_match', 'medium', 'mixed')$$,
  'the legitimate booking-flow.tsx insert (no payment_status/payment_id column) still succeeds'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
