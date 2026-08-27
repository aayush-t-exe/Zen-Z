-- ============================================
-- 007_leave_group.sql
--
-- Leaving a group (0048_leave_group.sql): a student can't leave before
-- the meet has happened, can leave once it has, disappears from their
-- own my_group_details + message access afterward, and can't leave the
-- same group twice. A groupmate who hasn't left is unaffected.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/007_leave_group.sql
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(7);

-- ---- fixtures ----
insert into auth.users (id, email) values
  ('a7000000-0000-0000-0000-000000000001', 'pgtap-lg-a@test.local'),
  ('a7000000-0000-0000-0000-000000000002', 'pgtap-lg-b@test.local');

update profiles set full_name = 'LG Student A' where id = 'a7000000-0000-0000-0000-000000000001';
update profiles set full_name = 'LG Student B' where id = 'a7000000-0000-0000-0000-000000000002';

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90007, 'pgtap LG Cafe', 2, 2);
insert into venues (id, name, address, activity_type_id)
  values ('c7000000-0000-0000-0000-000000000001', 'pgtap LG Venue', '123 Test St', 90007);

-- Slot 3 days out -> meet hasn't happened yet.
insert into slots (id, activity_type_id, slot_datetime)
  values ('b7000000-0000-0000-0000-000000000001', 90007, now() + interval '3 days');
-- Slot 1 day in the past -> meet is already over.
insert into slots (id, activity_type_id, slot_datetime)
  values ('b7000000-0000-0000-0000-000000000002', 90007, now() - interval '1 day');

insert into groups (id, slot_id, venue_id, status) values
  ('d7000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000001', 'c7000000-0000-0000-0000-000000000001', 'confirmed'),
  ('d7000000-0000-0000-0000-000000000002', 'b7000000-0000-0000-0000-000000000002', 'c7000000-0000-0000-0000-000000000001', 'confirmed');

insert into bookings (id, user_id, slot_id, status, payment_status) values
  ('e7000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000001', 'matched', 'paid'),
  ('e7000000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000002', 'b7000000-0000-0000-0000-000000000001', 'matched', 'paid'),
  ('e7000000-0000-0000-0000-000000000003', 'a7000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000002', 'matched', 'paid'),
  ('e7000000-0000-0000-0000-000000000004', 'a7000000-0000-0000-0000-000000000002', 'b7000000-0000-0000-0000-000000000002', 'matched', 'paid');

insert into group_members (group_id, booking_id) values
  ('d7000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000001'),
  ('d7000000-0000-0000-0000-000000000001', 'e7000000-0000-0000-0000-000000000002'),
  ('d7000000-0000-0000-0000-000000000002', 'e7000000-0000-0000-0000-000000000003'),
  ('d7000000-0000-0000-0000-000000000002', 'e7000000-0000-0000-0000-000000000004');

-- ---- simulate Student A's session ----
select set_config('request.jwt.claims', json_build_object('sub', 'a7000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$update group_members set left_at = now() where booking_id = 'e7000000-0000-0000-0000-000000000001'$$,
  null, null,
  'leaving a group before the meet has happened is rejected'
);

insert into pgtap_output select lives_ok(
  $$update group_members set left_at = now() where booking_id = 'e7000000-0000-0000-0000-000000000003'$$,
  'leaving a group after the meet has happened succeeds'
);

insert into pgtap_output select throws_ok(
  $$update group_members set left_at = now() where booking_id = 'e7000000-0000-0000-0000-000000000003'$$,
  null, null,
  'leaving the same group twice is rejected'
);

insert into pgtap_output select is(
  (select count(*)::int from my_group_details where group_id = 'd7000000-0000-0000-0000-000000000002'),
  0,
  'the group no longer shows up in the leaver''s my_group_details'
);

insert into pgtap_output select is(
  (select count(*)::int from messages where group_id = 'd7000000-0000-0000-0000-000000000002'),
  0,
  'the leaver can no longer read messages in that group (RLS filters them out)'
);

-- ---- Student B (still a member, never left) is unaffected ----
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a7000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select is(
  (select count(*)::int from my_group_details where group_id = 'd7000000-0000-0000-0000-000000000002'),
  1,
  'a groupmate who has not left still sees the group in my_group_details'
);

insert into pgtap_output select lives_ok(
  $$insert into messages (group_id, sender_id, content) values ('d7000000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000002', 'still here')$$,
  'a groupmate who has not left can still send messages'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
