-- ============================================
-- 014_admin_cancel_booking.sql
--
-- admin_cancel_booking() (0070) is the founder's single cancel action,
-- working the same way whether a booking is still pending_match (not
-- yet grouped) or already placed into a confirmed group. This proves:
-- non-admins are rejected, a pending_match booking cancels cleanly
-- without touching payment_status, an already-cancelled booking can't
-- be cancelled again, a matched booking's group_members row is deleted
-- outright (not left_at-archived) while the OTHER group member is
-- untouched and gets notified, and the cancelled student themselves
-- does NOT get that "someone left" notification.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/014_admin_cancel_booking.sql
-- Everything happens inside a rolled-back transaction — no fixture data
-- is left behind in the dev project.
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(11);

-- ---- fixtures (run as postgres, which bypasses RLS) ----
insert into auth.users (id, email) values
  ('ac000000-0000-0000-0000-000000000201', 'pgtap-acb-student1@test.local'),
  ('ac000000-0000-0000-0000-000000000202', 'pgtap-acb-student2@test.local'),
  ('ac000000-0000-0000-0000-000000000203', 'pgtap-acb-admin@test.local');

update profiles set full_name = 'Acb Student One' where id = 'ac000000-0000-0000-0000-000000000201';
update profiles set full_name = 'Acb Student Two' where id = 'ac000000-0000-0000-0000-000000000202';
insert into admin_users (id) values ('ac000000-0000-0000-0000-000000000203');

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90014, 'pgtap Acb Cafe', 2, 4);
insert into venues (id, name, activity_type_id)
  values ('cc000000-0000-0000-0000-000000000201', 'pgtap Acb Venue', 90014);
insert into slots (id, activity_type_id, slot_datetime) values
  ('bc000000-0000-0000-0000-000000000201', 90014, now() + interval '5 days'),
  ('bc000000-0000-0000-0000-000000000202', 90014, now() + interval '5 days');

-- A standalone, not-yet-grouped booking (pre-match case).
insert into bookings (id, user_id, slot_id, status, payment_status, budget_band, group_preference)
  values ('ec000000-0000-0000-0000-000000000201', 'ac000000-0000-0000-0000-000000000201',
    'bc000000-0000-0000-0000-000000000201', 'pending_match', 'paid', 'medium', 'mixed');

-- A confirmed group of two (post-match case).
insert into bookings (id, user_id, slot_id, status, payment_status, budget_band, group_preference) values
  ('ec000000-0000-0000-0000-000000000202', 'ac000000-0000-0000-0000-000000000201',
    'bc000000-0000-0000-0000-000000000202', 'matched', 'paid', 'medium', 'mixed'),
  ('ec000000-0000-0000-0000-000000000203', 'ac000000-0000-0000-0000-000000000202',
    'bc000000-0000-0000-0000-000000000202', 'matched', 'paid', 'medium', 'mixed');
insert into groups (id, slot_id, venue_id, status)
  values ('dc000000-0000-0000-0000-000000000201', 'bc000000-0000-0000-0000-000000000202',
    'cc000000-0000-0000-0000-000000000201', 'confirmed');
insert into group_members (group_id, booking_id) values
  ('dc000000-0000-0000-0000-000000000201', 'ec000000-0000-0000-0000-000000000202'),
  ('dc000000-0000-0000-0000-000000000201', 'ec000000-0000-0000-0000-000000000203');

-- ---- simulate a non-admin's session ----
select set_config('request.jwt.claims', json_build_object('sub', 'ac000000-0000-0000-0000-000000000201', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$select admin_cancel_booking('ec000000-0000-0000-0000-000000000201')$$,
  null, null,
  'a non-admin cannot cancel a booking, even their own'
);

-- ---- simulate the admin's session ----
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'ac000000-0000-0000-0000-000000000203', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$select admin_cancel_booking('00000000-0000-0000-0000-000000000000')$$,
  null, null,
  'cancelling a booking that does not exist raises, not a silent no-op'
);

insert into pgtap_output select lives_ok(
  $$select admin_cancel_booking('ec000000-0000-0000-0000-000000000201')$$,
  'an admin can cancel a pending_match (not yet grouped) booking'
);

insert into pgtap_output select is(
  (select status from bookings where id = 'ec000000-0000-0000-0000-000000000201'),
  'cancelled',
  'the pre-match booking is now cancelled'
);

insert into pgtap_output select is(
  (select payment_status from bookings where id = 'ec000000-0000-0000-0000-000000000201'),
  'paid',
  'payment_status is left untouched — refunds are always a manual, founder-driven PayU-dashboard action'
);

insert into pgtap_output select throws_ok(
  $$select admin_cancel_booking('ec000000-0000-0000-0000-000000000201')$$,
  null, null,
  'cancelling an already-cancelled booking raises instead of silently succeeding twice'
);

insert into pgtap_output select lives_ok(
  $$select admin_cancel_booking('ec000000-0000-0000-0000-000000000202')$$,
  'an admin can cancel a booking that is already placed in a confirmed group'
);

insert into pgtap_output select is(
  (select count(*)::int from group_members where booking_id = 'ec000000-0000-0000-0000-000000000202'),
  0,
  'the cancelled booking''s group_members row is deleted outright, not left_at-archived'
);

insert into pgtap_output select is(
  (select count(*)::int from group_members where group_id = 'dc000000-0000-0000-0000-000000000201'),
  1,
  'the other group member''s own group_members row is untouched'
);

insert into pgtap_output select is(
  (select count(*)::int from notifications_outbox
    where user_id = 'ac000000-0000-0000-0000-000000000202'
      and type = 'group_member_left' and reference_id = 'dc000000-0000-0000-0000-000000000201'),
  1,
  'the remaining groupmate gets a group_member_left notification'
);

insert into pgtap_output select is(
  (select count(*)::int from notifications_outbox
    where user_id = 'ac000000-0000-0000-0000-000000000201'
      and type = 'group_member_left' and reference_id = 'dc000000-0000-0000-0000-000000000201'),
  0,
  'the cancelled student themselves does not get a "someone left" notification about their own cancellation'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
