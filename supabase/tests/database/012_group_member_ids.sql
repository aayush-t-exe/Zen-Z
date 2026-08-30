-- ============================================
-- 012_group_member_ids.sql
-- Milestone 19: Testing.
--
-- Regression test for a real bug: fetchGroupMembers()
-- (apps/mobile/src/lib/groups.ts) used to resolve a group's member
-- user_ids via `group_members.select('bookings:booking_id(user_id)')` —
-- an embedded join into `bookings`, which only allows reading your OWN
-- row (0001_init.sql's "own bookings" policy). PostgREST resolves a
-- blocked embedded resource as null, so every groupmate's user_id
-- silently disappeared, leaving a student able to see only themselves in
-- both the reveal screen and chat (memberName()'s "Someone" fallback).
--
-- group_member_ids() (0065) fixes this the same way groupmate_user_ids()
-- (0022) already fixes the analogous profiles problem: a SECURITY
-- DEFINER function that does the group_members/bookings join internally,
-- scoped to a group the caller actually belongs to. This test exercises
-- the exact end-to-end path the client now uses (group_member_ids() ->
-- group_member_public), not just the view in isolation — that gap is
-- exactly why 001_photo_privacy.sql's existing group_member_public
-- coverage never caught this bug.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/012_group_member_ids.sql
-- Everything happens inside a rolled-back transaction — no fixture data
-- is left behind in the dev project.
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(4);

-- ---- fixtures (run as postgres, which bypasses RLS) ----
insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-000000000001', 'pgtap-gmi-a@test.local'),
  ('f0000000-0000-0000-0000-000000000002', 'pgtap-gmi-b@test.local'),
  ('f0000000-0000-0000-0000-000000000003', 'pgtap-gmi-c@test.local');

update profiles set full_name = 'Gmi A', gender = 'female', year_of_study = 2 where id = 'f0000000-0000-0000-0000-000000000001';
update profiles set full_name = 'Gmi B', gender = 'female', year_of_study = 3 where id = 'f0000000-0000-0000-0000-000000000002';
update profiles set full_name = 'Gmi C', gender = 'female', year_of_study = 1 where id = 'f0000000-0000-0000-0000-000000000003';

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90002, 'pgtap Gmi Cafe', 2, 2);
insert into slots (id, activity_type_id, slot_datetime)
  values ('f0000000-0000-0000-0000-000000000010', 90002, now() + interval '3 days');
insert into venues (id, name, activity_type_id)
  values ('f0000000-0000-0000-0000-000000000011', 'pgtap Gmi Venue', 90002);
insert into groups (id, slot_id, venue_id, status)
  values ('f0000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000010',
    'f0000000-0000-0000-0000-000000000011', 'confirmed');

-- A and B are in the group; C is not.
insert into bookings (id, user_id, slot_id, status, payment_status) values
  ('f0000000-0000-0000-0000-000000000030', 'f0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000010', 'matched', 'paid'),
  ('f0000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000010', 'matched', 'paid');

insert into group_members (group_id, booking_id) values
  ('f0000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000030'),
  ('f0000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000031');

-- ---- simulate Student A's session (a real member of the group) ----
select set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select is(
  (select count(*)::int from group_member_ids('f0000000-0000-0000-0000-000000000020')),
  2,
  'a group member sees BOTH member ids, not just their own — the actual bug'
);

insert into pgtap_output select is(
  (select count(*)::int from group_member_public
    where id in (select group_member_ids('f0000000-0000-0000-0000-000000000020'))),
  2,
  'the exact path fetchGroupMembers() now uses resolves both members'' names, end to end'
);

insert into pgtap_output select is(
  (select first_name from group_member_public where id = 'f0000000-0000-0000-0000-000000000002'),
  'Gmi',
  'a group member sees their groupmate''s actual first name, not a fallback'
);

-- ---- reset to postgres, then simulate Student C's session (not a member) ----
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select is(
  (select count(*)::int from group_member_ids('f0000000-0000-0000-0000-000000000020')),
  0,
  'a non-member cannot enumerate this group''s member ids'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
