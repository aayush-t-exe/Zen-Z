-- ============================================
-- 016_booking_plus_one_capacity.sql
--
-- 0072_booking_plus_one.sql changed confirm_group() and
-- admin_add_group_member()'s size gate from counting booking *rows* to
-- summing *seats* (a +1 booking counts as 2). This proves the seat-sum,
-- not the row count, is what actually drives both gates:
--   - confirm_group() rejects a set of bookings whose seat-sum exceeds
--     max_group_size even though the row count alone would have fit.
--   - confirm_group() succeeds at an exact seat-sum fit, and group_members
--     still ends up with one row per booking (not per seat).
--   - admin_add_group_member() rejects adding a +1 booking when only one
--     seat is free, then accepts a normal 1-seat booking that fills the
--     group exactly.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/016_booking_plus_one_capacity.sql
-- Everything happens inside a rolled-back transaction — no fixture data
-- is left behind in the dev project.
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(6);

-- ---- fixtures (run as postgres, which bypasses RLS) ----
insert into auth.users (id, email) values
  ('af000000-0000-0000-0000-000000000401', 'pgtap-bpo-single1@test.local'),
  ('af000000-0000-0000-0000-000000000402', 'pgtap-bpo-plusonea@test.local'),
  ('af000000-0000-0000-0000-000000000403', 'pgtap-bpo-plusoneb@test.local'),
  ('af000000-0000-0000-0000-000000000404', 'pgtap-bpo-single2@test.local'),
  ('af000000-0000-0000-0000-000000000405', 'pgtap-bpo-existing1@test.local'),
  ('af000000-0000-0000-0000-000000000406', 'pgtap-bpo-existing2@test.local'),
  ('af000000-0000-0000-0000-000000000407', 'pgtap-bpo-addplusone@test.local'),
  ('af000000-0000-0000-0000-000000000408', 'pgtap-bpo-addnormal@test.local'),
  ('af000000-0000-0000-0000-000000000409', 'pgtap-bpo-admin@test.local');

update profiles set full_name = 'Bpo Single1' where id = 'af000000-0000-0000-0000-000000000401';
update profiles set full_name = 'Bpo PlusOneA' where id = 'af000000-0000-0000-0000-000000000402';
update profiles set full_name = 'Bpo PlusOneB' where id = 'af000000-0000-0000-0000-000000000403';
update profiles set full_name = 'Bpo Single2' where id = 'af000000-0000-0000-0000-000000000404';
update profiles set full_name = 'Bpo Existing1' where id = 'af000000-0000-0000-0000-000000000405';
update profiles set full_name = 'Bpo Existing2' where id = 'af000000-0000-0000-0000-000000000406';
update profiles set full_name = 'Bpo AddPlusOne' where id = 'af000000-0000-0000-0000-000000000407';
update profiles set full_name = 'Bpo AddNormal' where id = 'af000000-0000-0000-0000-000000000408';
insert into admin_users (id) values ('af000000-0000-0000-0000-000000000409');

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90016, 'pgtap Bpo Cafe', 2, 4);
insert into venues (id, name, activity_type_id)
  values ('cf000000-0000-0000-0000-000000000401', 'pgtap Bpo Venue', 90016);
insert into slots (id, activity_type_id, slot_datetime) values
  ('bf000000-0000-0000-0000-000000000401', 90016, now() + interval '5 days'),
  ('bf000000-0000-0000-0000-000000000402', 90016, now() + interval '5 days'),
  ('bf000000-0000-0000-0000-000000000403', 90016, now() + interval '5 days');

-- ---- Scenario A (slot 1): 3 booking rows, seat-sum 5, max_group_size 4 ----
-- Row count (3) would have passed the old count(*)-based gate; only the
-- seat-sum correctly rejects this.
insert into bookings (id, user_id, slot_id, status, payment_status, budget_band, group_preference, plus_one, plus_one_name) values
  ('ef000000-0000-0000-0000-000000000401', 'af000000-0000-0000-0000-000000000401',
    'bf000000-0000-0000-0000-000000000401', 'pending_match', 'paid', 'medium', 'mixed', false, null),
  ('ef000000-0000-0000-0000-000000000402', 'af000000-0000-0000-0000-000000000402',
    'bf000000-0000-0000-0000-000000000401', 'pending_match', 'paid', 'medium', 'mixed', true, 'Friend A'),
  ('ef000000-0000-0000-0000-000000000403', 'af000000-0000-0000-0000-000000000403',
    'bf000000-0000-0000-0000-000000000401', 'pending_match', 'paid', 'medium', 'mixed', true, 'Friend B');

-- ---- Scenario B (slot 2): 3 booking rows, seat-sum exactly 4 ----
insert into bookings (id, user_id, slot_id, status, payment_status, budget_band, group_preference, plus_one, plus_one_name) values
  ('ef000000-0000-0000-0000-000000000404', 'af000000-0000-0000-0000-000000000404',
    'bf000000-0000-0000-0000-000000000402', 'pending_match', 'paid', 'medium', 'mixed', false, null),
  ('ef000000-0000-0000-0000-000000000405', 'af000000-0000-0000-0000-000000000402',
    'bf000000-0000-0000-0000-000000000402', 'pending_match', 'paid', 'medium', 'mixed', true, 'Friend A'),
  ('ef000000-0000-0000-0000-000000000406', 'af000000-0000-0000-0000-000000000403',
    'bf000000-0000-0000-0000-000000000402', 'pending_match', 'paid', 'medium', 'mixed', false, null);

-- ---- Scenario C (slot 3): an already-confirmed group with 3 of 4 seats
-- taken (1 normal + 1 plus_one), one seat free ----
insert into bookings (id, user_id, slot_id, status, payment_status, budget_band, group_preference, plus_one, plus_one_name) values
  ('ef000000-0000-0000-0000-000000000407', 'af000000-0000-0000-0000-000000000405',
    'bf000000-0000-0000-0000-000000000403', 'matched', 'paid', 'medium', 'mixed', false, null),
  ('ef000000-0000-0000-0000-000000000408', 'af000000-0000-0000-0000-000000000406',
    'bf000000-0000-0000-0000-000000000403', 'matched', 'paid', 'medium', 'mixed', true, 'Friend E2');
insert into groups (id, slot_id, venue_id, status)
  values ('df000000-0000-0000-0000-000000000401', 'bf000000-0000-0000-0000-000000000403',
    'cf000000-0000-0000-0000-000000000401', 'confirmed');
insert into group_members (group_id, booking_id) values
  ('df000000-0000-0000-0000-000000000401', 'ef000000-0000-0000-0000-000000000407'),
  ('df000000-0000-0000-0000-000000000401', 'ef000000-0000-0000-0000-000000000408');

insert into bookings (id, user_id, slot_id, status, payment_status, budget_band, group_preference, plus_one, plus_one_name) values
  ('ef000000-0000-0000-0000-000000000409', 'af000000-0000-0000-0000-000000000407',
    'bf000000-0000-0000-0000-000000000403', 'pending_match', 'paid', 'medium', 'mixed', true, 'Friend AC'),
  ('ef000000-0000-0000-0000-000000000410', 'af000000-0000-0000-0000-000000000408',
    'bf000000-0000-0000-0000-000000000403', 'pending_match', 'paid', 'medium', 'mixed', false, null);

-- ---- simulate the admin's session ----
select set_config('request.jwt.claims', json_build_object('sub', 'af000000-0000-0000-0000-000000000409', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$select confirm_group('bf000000-0000-0000-0000-000000000401', 'cf000000-0000-0000-0000-000000000401',
      array['ef000000-0000-0000-0000-000000000401'::uuid, 'ef000000-0000-0000-0000-000000000402'::uuid, 'ef000000-0000-0000-0000-000000000403'::uuid])$$,
  null, null,
  'confirm_group rejects a seat-sum of 5 over a max_group_size of 4, even though the row count (3) alone would fit'
);

insert into pgtap_output select lives_ok(
  $$select confirm_group('bf000000-0000-0000-0000-000000000402', 'cf000000-0000-0000-0000-000000000401',
      array['ef000000-0000-0000-0000-000000000404'::uuid, 'ef000000-0000-0000-0000-000000000405'::uuid, 'ef000000-0000-0000-0000-000000000406'::uuid])$$,
  'confirm_group succeeds when the seat-sum lands exactly at max_group_size (4)'
);

insert into pgtap_output select is(
  (select count(*)::int from group_members gm
    join groups g on g.id = gm.group_id
    where g.slot_id = 'bf000000-0000-0000-0000-000000000402'),
  3,
  'group_members still has one row per booking (3), not one per seat (4)'
);

insert into pgtap_output select throws_ok(
  $$select admin_add_group_member('df000000-0000-0000-0000-000000000401', 'ef000000-0000-0000-0000-000000000409')$$,
  null, null,
  'admin_add_group_member rejects a +1 (2-seat) booking when the group only has 1 seat free'
);

insert into pgtap_output select lives_ok(
  $$select admin_add_group_member('df000000-0000-0000-0000-000000000401', 'ef000000-0000-0000-0000-000000000410')$$,
  'admin_add_group_member accepts a normal (1-seat) booking that fills the group exactly'
);

insert into pgtap_output select is(
  (select count(*)::int from group_members where group_id = 'df000000-0000-0000-0000-000000000401'),
  3,
  'the group now has 3 booking rows (existing1, existing2, addnormal) summing to 4 seats'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
