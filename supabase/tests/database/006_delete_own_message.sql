-- ============================================
-- 006_delete_own_message.sql
--
-- Deleting a group-chat message (0047_delete_own_messages.sql): a student can
-- tombstone their own group-chat message (content wiped, deleted_at set),
-- can't touch a groupmate's message, and can't delete the same message
-- twice.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/006_delete_own_message.sql
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(5);

-- ---- fixtures ----
insert into auth.users (id, email) values
  ('a6000000-0000-0000-0000-000000000001', 'pgtap-dm-a@test.local'),
  ('a6000000-0000-0000-0000-000000000002', 'pgtap-dm-b@test.local');

update profiles set full_name = 'DM Student A' where id = 'a6000000-0000-0000-0000-000000000001';
update profiles set full_name = 'DM Student B' where id = 'a6000000-0000-0000-0000-000000000002';

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90006, 'pgtap DM Cafe', 2, 2);
insert into venues (id, name, address, activity_type_id)
  values ('c6000000-0000-0000-0000-000000000001', 'pgtap DM Venue', '123 Test St', 90006);

-- Slot 1 day out -> reveal_venue_at is ~1 day in the past (already revealed),
-- so chat is open for both reading and this update.
insert into slots (id, activity_type_id, slot_datetime)
  values ('b6000000-0000-0000-0000-000000000001', 90006, now() + interval '1 day');

insert into groups (id, slot_id, venue_id, status) values
  ('d6000000-0000-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000001', 'c6000000-0000-0000-0000-000000000001', 'confirmed');

insert into bookings (id, user_id, slot_id, status, payment_status) values
  ('e6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000001', 'matched', 'paid'),
  ('e6000000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000002', 'b6000000-0000-0000-0000-000000000001', 'matched', 'paid');

insert into group_members (group_id, booking_id) values
  ('d6000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000001'),
  ('d6000000-0000-0000-0000-000000000001', 'e6000000-0000-0000-0000-000000000002');

-- Seed one message from A, inserted directly (bypasses RLS as postgres).
insert into messages (id, group_id, sender_id, content) values
  ('f6000000-0000-0000-0000-000000000001', 'd6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'hello from A');

-- ---- Student B (not the sender) tries to delete A's message ----
select set_config('request.jwt.claims', json_build_object('sub', 'a6000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

update messages set deleted_at = now() where id = 'f6000000-0000-0000-0000-000000000001';

reset role;

insert into pgtap_output select is(
  (select content from messages where id = 'f6000000-0000-0000-0000-000000000001'),
  'hello from A',
  'a non-sender updating the row leaves content untouched (RLS filters it out)'
);

-- ---- Student A (the sender) deletes their own message ----
select set_config('request.jwt.claims', json_build_object('sub', 'a6000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select lives_ok(
  $$update messages set deleted_at = now() where id = 'f6000000-0000-0000-0000-000000000001'$$,
  'the sender can delete their own message'
);

insert into pgtap_output select throws_ok(
  $$update messages set deleted_at = now() where id = 'f6000000-0000-0000-0000-000000000001'$$,
  null, null,
  'deleting an already-deleted message is rejected'
);

-- ---- post-conditions, checked as postgres ----
reset role;

insert into pgtap_output select is(
  (select content from messages where id = 'f6000000-0000-0000-0000-000000000001'),
  null,
  'content is wiped once the message is deleted'
);

insert into pgtap_output select isnt(
  (select deleted_at from messages where id = 'f6000000-0000-0000-0000-000000000001'),
  null,
  'deleted_at is set once the message is deleted'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
