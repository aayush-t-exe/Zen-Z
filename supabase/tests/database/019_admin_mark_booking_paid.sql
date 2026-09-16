-- ============================================
-- 019_admin_mark_booking_paid.sql
--
-- admin_mark_booking_paid() (0098) is the safe replacement for hand-run
-- SQL when a payment genuinely succeeded but its webhook never landed.
-- This proves: non-admins are rejected, an unpaid booking flips to paid,
-- payment_id is left untouched, a cancelled booking is refused (mirrors
-- the webhook's own shouldMarkBookingPaid cancel/payment-race guard), and
-- an already-paid booking is refused rather than silently no-op'd.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/019_admin_mark_booking_paid.sql
-- Everything happens inside a rolled-back transaction — no fixture data
-- is left behind in the dev project.
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(8);

-- ---- fixtures (run as postgres, which bypasses RLS) ----
insert into auth.users (id, email) values
  ('ad000000-0000-0000-0000-000000000201', 'pgtap-amb-student1@test.local'),
  ('ad000000-0000-0000-0000-000000000202', 'pgtap-amb-admin@test.local');

update profiles set full_name = 'Amb Student One' where id = 'ad000000-0000-0000-0000-000000000201';
insert into admin_users (id) values ('ad000000-0000-0000-0000-000000000202');

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90019, 'pgtap Amb Cafe', 2, 4);
insert into slots (id, activity_type_id, slot_datetime) values
  ('bd000000-0000-0000-0000-000000000201', 90019, now() + interval '5 days'),
  ('bd000000-0000-0000-0000-000000000202', 90019, now() + interval '6 days'),
  ('bd000000-0000-0000-0000-000000000203', 90019, now() + interval '7 days');

-- An unpaid booking with a payment attempt on record (payment_id set,
-- payment_status still 'unpaid') — the exact stuck-payment shape.
insert into bookings (id, user_id, slot_id, status, payment_status, payment_id, budget_band, group_preference)
  values ('ed000000-0000-0000-0000-000000000201', 'ad000000-0000-0000-0000-000000000201',
    'bd000000-0000-0000-0000-000000000201', 'pending_match', 'unpaid', 'stuckpayuref123', 'medium', 'mixed');

-- A cancelled booking (different slot — bookings_user_slot_active_unique
-- only allows one active booking per user+slot, and this is cancelled
-- specifically so it doesn't collide with the unpaid one above) — must be
-- refused even if it somehow still has a payment_id, same boundary the
-- webhook itself enforces.
insert into bookings (id, user_id, slot_id, status, payment_status, payment_id, budget_band, group_preference)
  values ('ed000000-0000-0000-0000-000000000202', 'ad000000-0000-0000-0000-000000000201',
    'bd000000-0000-0000-0000-000000000202', 'cancelled', 'unpaid', 'cancelledpayuref', 'medium', 'mixed');

-- Already paid (own slot, same reason) — must be refused, not silently
-- re-confirmed.
insert into bookings (id, user_id, slot_id, status, payment_status, payment_id, budget_band, group_preference)
  values ('ed000000-0000-0000-0000-000000000203', 'ad000000-0000-0000-0000-000000000201',
    'bd000000-0000-0000-0000-000000000203', 'pending_match', 'paid', 'alreadypaidref', 'medium', 'mixed');

-- ---- simulate a non-admin's session ----
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000201', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$select admin_mark_booking_paid('ed000000-0000-0000-0000-000000000201')$$,
  null, null,
  'a non-admin cannot mark a booking paid, even their own'
);

-- ---- simulate the admin's session ----
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000202', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$select admin_mark_booking_paid('00000000-0000-0000-0000-000000000000')$$,
  null, null,
  'marking a booking that does not exist raises, not a silent no-op'
);

insert into pgtap_output select throws_ok(
  $$select admin_mark_booking_paid('ed000000-0000-0000-0000-000000000202')$$,
  null, null,
  'a cancelled booking cannot be marked paid'
);

insert into pgtap_output select throws_ok(
  $$select admin_mark_booking_paid('ed000000-0000-0000-0000-000000000203')$$,
  null, null,
  'an already-paid booking is refused rather than silently re-confirmed'
);

insert into pgtap_output select lives_ok(
  $$select admin_mark_booking_paid('ed000000-0000-0000-0000-000000000201')$$,
  'an admin can mark a genuinely stuck unpaid booking as paid'
);

insert into pgtap_output select is(
  (select payment_status from bookings where id = 'ed000000-0000-0000-0000-000000000201'),
  'paid',
  'the booking is now paid'
);

insert into pgtap_output select is(
  (select payment_id from bookings where id = 'ed000000-0000-0000-0000-000000000201'),
  'stuckpayuref123',
  'payment_id is left exactly as it was — this RPC never invents or overwrites it'
);

insert into pgtap_output select throws_ok(
  $$select admin_mark_booking_paid('ed000000-0000-0000-0000-000000000201')$$,
  null, null,
  'calling it again on the now-paid booking is refused, not a silent double-confirm'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
