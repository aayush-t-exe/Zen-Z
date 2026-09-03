-- ============================================
-- 017_chat_notifications_and_unread.sql
--
-- 0066_new_message_notifications_and_unread_count.sql shipped with zero
-- automated coverage (flagged in a chat-feature audit before a wider test
-- rollout). Covers: enqueue_new_message() notifies every other active
-- member but not the sender, not a member who's left, and not for a
-- system message; is_system spoofing is still blocked (0055); and
-- my_unread_message_count()/mark_group_read() count and clear correctly,
-- excluding system messages.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/017_chat_notifications_and_unread.sql
-- Everything happens inside a rolled-back transaction — no fixture data
-- is left behind in the dev project.
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(9);

-- ---- fixtures (run as postgres, which bypasses RLS) ----
insert into auth.users (id, email) values
  ('c1700000-0000-0000-0000-000000000001', 'pgtap-cn-sender@test.local'),
  ('c1700000-0000-0000-0000-000000000002', 'pgtap-cn-recipient@test.local'),
  ('c1700000-0000-0000-0000-000000000003', 'pgtap-cn-left@test.local');

update profiles set full_name = 'CN Sender' where id = 'c1700000-0000-0000-0000-000000000001';
update profiles set full_name = 'CN Recipient' where id = 'c1700000-0000-0000-0000-000000000002';
update profiles set full_name = 'CN Left' where id = 'c1700000-0000-0000-0000-000000000003';

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90017, 'pgtap CN Cafe', 2, 3);
insert into venues (id, name, address, activity_type_id)
  values ('c1700000-0000-0000-0000-000000000101', 'pgtap CN Venue', '123 Test St', 90017);

-- Already past the reveal boundary, so chat is unlocked.
insert into slots (id, activity_type_id, slot_datetime)
  values ('c1700000-0000-0000-0000-000000000102', 90017, now() - interval '1 day');

insert into groups (id, slot_id, venue_id, status)
  values ('c1700000-0000-0000-0000-000000000201', 'c1700000-0000-0000-0000-000000000102', 'c1700000-0000-0000-0000-000000000101', 'confirmed');

insert into bookings (id, user_id, slot_id, status, payment_status) values
  ('c1700000-0000-0000-0000-000000000301', 'c1700000-0000-0000-0000-000000000001', 'c1700000-0000-0000-0000-000000000102', 'matched', 'paid'),
  ('c1700000-0000-0000-0000-000000000302', 'c1700000-0000-0000-0000-000000000002', 'c1700000-0000-0000-0000-000000000102', 'matched', 'paid'),
  ('c1700000-0000-0000-0000-000000000303', 'c1700000-0000-0000-0000-000000000003', 'c1700000-0000-0000-0000-000000000102', 'matched', 'paid');

insert into group_members (group_id, booking_id) values
  ('c1700000-0000-0000-0000-000000000201', 'c1700000-0000-0000-0000-000000000301'),
  ('c1700000-0000-0000-0000-000000000201', 'c1700000-0000-0000-0000-000000000302'),
  ('c1700000-0000-0000-0000-000000000201', 'c1700000-0000-0000-0000-000000000303');

-- now() is frozen at transaction-start for this whole pgTAP run (it's
-- transaction_timestamp() under the hood), so every default now() below —
-- group_members.last_read_at's default included — resolves to the exact
-- same instant as every message's default created_at. Backdating CN
-- Recipient's last_read_at explicitly is what gives the "unread since"
-- comparison in my_unread_message_count() something real to compare
-- against, rather than two ties that both evaluate to "not strictly after."
update group_members set last_read_at = now() - interval '1 hour'
  where group_id = 'c1700000-0000-0000-0000-000000000201' and booking_id = 'c1700000-0000-0000-0000-000000000302';

-- CN Left has already left the group (post-event, same as 007's fixture).
update group_members set left_at = now()
  where group_id = 'c1700000-0000-0000-0000-000000000201' and booking_id = 'c1700000-0000-0000-0000-000000000303';

-- ---- Sender posts a normal message ----
select set_config('request.jwt.claims', json_build_object('sub', 'c1700000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select lives_ok(
  $$insert into messages (group_id, sender_id, content) values ('c1700000-0000-0000-0000-000000000201', 'c1700000-0000-0000-0000-000000000001', 'hello group')$$,
  'the sender can post a normal message'
);

insert into pgtap_output select throws_ok(
  $$insert into messages (group_id, sender_id, content, is_system) values ('c1700000-0000-0000-0000-000000000201', 'c1700000-0000-0000-0000-000000000001', 'fake system line', true)$$,
  null, null,
  'a student still cannot spoof is_system = true (0055 regression)'
);

reset role;

insert into pgtap_output select is(
  (select count(*)::int from notifications_outbox
    where type = 'new_message' and user_id = 'c1700000-0000-0000-0000-000000000002'),
  1,
  'the active groupmate got exactly one new_message notification'
);

insert into pgtap_output select is(
  (select count(*)::int from notifications_outbox
    where type = 'new_message' and user_id = 'c1700000-0000-0000-0000-000000000001'),
  0,
  'the sender is never notified of their own message'
);

insert into pgtap_output select is(
  (select count(*)::int from notifications_outbox
    where type = 'new_message' and user_id = 'c1700000-0000-0000-0000-000000000003'),
  0,
  'the member who already left the group is not notified'
);

-- ---- a legitimate system message (inserted as postgres, bypassing RLS
-- the same way post_venue_reveal_messages() does) must not itself queue
-- a new_message notification ----
insert into messages (group_id, sender_id, content, is_system)
  values ('c1700000-0000-0000-0000-000000000201', null, 'The mystery unlocks.', true);

insert into pgtap_output select is(
  (select count(*)::int from notifications_outbox
    where type = 'new_message' and user_id = 'c1700000-0000-0000-0000-000000000002'),
  1,
  'a system message does not generate a second new_message notification'
);

-- ---- unread count / mark read, as the recipient ----
select set_config('request.jwt.claims', json_build_object('sub', 'c1700000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select is(
  (select my_unread_message_count()),
  1,
  'recipient sees exactly 1 unread — the normal message, not the system one'
);

select mark_group_read('c1700000-0000-0000-0000-000000000201');

insert into pgtap_output select is(
  (select my_unread_message_count()),
  0,
  'unread count clears to 0 after mark_group_read'
);

-- Same frozen-now() issue as above: inserted as postgres with an explicit
-- created_at one second past "now" so it unambiguously lands after the
-- last_read_at that mark_group_read() just set (also frozen at now()).
reset role;
insert into messages (group_id, sender_id, content, created_at)
  values ('c1700000-0000-0000-0000-000000000201', 'c1700000-0000-0000-0000-000000000001', 'you there?', now() + interval '1 second');

select set_config('request.jwt.claims', json_build_object('sub', 'c1700000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select is(
  (select my_unread_message_count()),
  1,
  'a later message after mark_group_read shows up as unread again'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
