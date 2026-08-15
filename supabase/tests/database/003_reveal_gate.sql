-- ============================================
-- 003_reveal_gate.sql
-- Milestone 19: Testing.
--
-- The 48h-before-the-event reveal gate (0018_group_reveal_and_chat.sql):
-- venue and group chat stay locked until `reveal_venue_at`
-- (slot_datetime - 48h), enforced by the messages RLS policies and
-- computed fresh in the `my_group_details` view rather than trusted from
-- the client. Also covers the "members read own revealed venue" policy on
-- `venues` (0025_venue_reveal_rls_fix.sql) — without it, my_group_details'
-- join to venues silently returns null for every student, reveal gate or
-- not.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/003_reveal_gate.sql
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(7);

-- ---- fixtures ----
insert into auth.users (id, email) values
  ('a2000000-0000-0000-0000-000000000001', 'pgtap-rg-a@test.local'),
  ('a2000000-0000-0000-0000-000000000002', 'pgtap-rg-b@test.local');

update profiles set full_name = 'RG Student A' where id = 'a2000000-0000-0000-0000-000000000001';
update profiles set full_name = 'RG Student B' where id = 'a2000000-0000-0000-0000-000000000002';

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90003, 'pgtap RG Cafe', 2, 2);
insert into venues (id, name, address, activity_type_id)
  values ('c2000000-0000-0000-0000-000000000001', 'pgtap RG Venue', '123 Test St', 90003);

-- Slot 3 days out -> reveal_venue_at is ~1 day in the future (not revealed).
insert into slots (id, activity_type_id, slot_datetime)
  values ('b2000000-0000-0000-0000-000000000001', 90003, now() + interval '3 days');
-- Slot 1 day out -> reveal_venue_at is ~1 day in the past (already revealed).
insert into slots (id, activity_type_id, slot_datetime)
  values ('b2000000-0000-0000-0000-000000000002', 90003, now() + interval '1 day');

insert into groups (id, slot_id, venue_id, status) values
  ('d2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'confirmed'),
  ('d2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'confirmed');

insert into bookings (id, user_id, slot_id, status, payment_status) values
  ('e2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', 'matched', 'paid'),
  ('e2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001', 'matched', 'paid'),
  ('e2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', 'matched', 'paid'),
  ('e2000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000002', 'matched', 'paid');

insert into group_members (group_id, booking_id) values
  ('d2000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001'),
  ('d2000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002'),
  ('d2000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000003'),
  ('d2000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000004');

-- Seed one message in each group, inserted directly (bypasses RLS as postgres).
insert into messages (group_id, sender_id, content) values
  ('d2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'hello from B (not-yet-revealed group)'),
  ('d2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'hello from B (revealed group)');

-- ---- simulate Student A's session ----
select set_config('request.jwt.claims', json_build_object('sub', 'a2000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select is(
  (select count(*)::int from messages where group_id = 'd2000000-0000-0000-0000-000000000001'),
  0,
  'messages are not readable before the reveal gate'
);

insert into pgtap_output select throws_ok(
  $$insert into messages (group_id, sender_id, content) values ('d2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'too early')$$,
  null, null,
  'sending a message before the reveal gate is rejected'
);

insert into pgtap_output select is(
  (select count(*)::int from messages where group_id = 'd2000000-0000-0000-0000-000000000002'),
  1,
  'messages are readable once the reveal gate has passed'
);

insert into pgtap_output select lives_ok(
  $$insert into messages (group_id, sender_id, content) values ('d2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001', 'on time')$$,
  'sending a message after the reveal gate succeeds'
);

insert into pgtap_output select is(
  (select venue_name from my_group_details where group_id = 'd2000000-0000-0000-0000-000000000001'),
  null,
  'venue_name is null before the reveal gate'
);

insert into pgtap_output select is(
  (select venue_name from my_group_details where group_id = 'd2000000-0000-0000-0000-000000000002'),
  'pgtap RG Venue',
  'venue_name is populated after the reveal gate'
);

insert into pgtap_output select is(
  (select venue_address from my_group_details where group_id = 'd2000000-0000-0000-0000-000000000002'),
  '123 Test St',
  'venue_address is populated after the reveal gate'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
