-- ============================================
-- 008_reveal_reported_message.sql
--
-- Message-level reporting (0049_message_level_reports.sql): a report can
-- point at a specific chat message, but the only way to ever see that
-- message's content from the admin side is reveal_reported_message(),
-- which (a) requires an admin, (b) requires the report to actually have
-- a message_id, and (c) logs one row per call in
-- report_message_reveals — this is the "deliberate, logged exception"
-- to the "admin never renders chat content" policy in
-- docs/ARCHITECTURE.md "Chat privacy", not a general-purpose chat reader.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/008_reveal_reported_message.sql
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(5);

-- ---- fixtures ----
insert into auth.users (id, email) values
  ('a8000000-0000-0000-0000-000000000001', 'pgtap-rr-reporter@test.local'),
  ('a8000000-0000-0000-0000-000000000002', 'pgtap-rr-reported@test.local'),
  ('a8000000-0000-0000-0000-000000000003', 'pgtap-rr-admin@test.local');

update profiles set full_name = 'RR Reporter' where id = 'a8000000-0000-0000-0000-000000000001';
update profiles set full_name = 'RR Reported' where id = 'a8000000-0000-0000-0000-000000000002';
update profiles set full_name = 'RR Admin' where id = 'a8000000-0000-0000-0000-000000000003';

insert into admin_users (id) values ('a8000000-0000-0000-0000-000000000003');

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90008, 'pgtap RR Cafe', 2, 2);
insert into venues (id, name, address, activity_type_id)
  values ('c8000000-0000-0000-0000-000000000001', 'pgtap RR Venue', '123 Test St', 90008);

-- Slot 1 day out -> reveal_venue_at is in the past, so chat is open.
insert into slots (id, activity_type_id, slot_datetime)
  values ('b8000000-0000-0000-0000-000000000001', 90008, now() + interval '1 day');

insert into groups (id, slot_id, venue_id, status) values
  ('d8000000-0000-0000-0000-000000000001', 'b8000000-0000-0000-0000-000000000001', 'c8000000-0000-0000-0000-000000000001', 'confirmed');

insert into bookings (id, user_id, slot_id, status, payment_status) values
  ('e8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001', 'b8000000-0000-0000-0000-000000000001', 'matched', 'paid'),
  ('e8000000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-000000000002', 'b8000000-0000-0000-0000-000000000001', 'matched', 'paid');

insert into group_members (group_id, booking_id) values
  ('d8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000001'),
  ('d8000000-0000-0000-0000-000000000001', 'e8000000-0000-0000-0000-000000000002');

-- Two messages from the reported student: one kept, one deleted before
-- any report is filed against it.
insert into messages (id, group_id, sender_id, content) values
  ('f8000000-0000-0000-0000-000000000001', 'd8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000002', 'hello from reported'),
  ('f8000000-0000-0000-0000-000000000002', 'd8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000002', 'this one gets deleted');

update messages set content = null, deleted_at = now() where id = 'f8000000-0000-0000-0000-000000000002';

-- Three reports: one tied to the kept message, one with no message at
-- all (plain groupmate report), one tied to the deleted message.
insert into reports (id, reporter_id, reported_user_id, group_id, reason, message_id) values
  ('a8000000-0000-0000-0002-000000000001', 'a8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000002', 'd8000000-0000-0000-0000-000000000001', 'test reason', 'f8000000-0000-0000-0000-000000000001'),
  ('a8000000-0000-0000-0002-000000000002', 'a8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000002', 'd8000000-0000-0000-0000-000000000001', 'test reason, no message', null),
  ('a8000000-0000-0000-0002-000000000003', 'a8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000002', 'd8000000-0000-0000-0000-000000000001', 'test reason, deleted message', 'f8000000-0000-0000-0000-000000000002');

-- ---- the reporter (not an admin) tries to reveal the flagged message ----
select set_config('request.jwt.claims', json_build_object('sub', 'a8000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$select * from reveal_reported_message('a8000000-0000-0000-0002-000000000001')$$,
  null, null,
  'a non-admin cannot reveal a flagged message'
);

reset role;

-- ---- the admin tries to reveal a report with no message attached ----
select set_config('request.jwt.claims', json_build_object('sub', 'a8000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$select * from reveal_reported_message('a8000000-0000-0000-0002-000000000002')$$,
  null, null,
  'a report with no message_id cannot be revealed'
);

-- ---- the admin reveals the flagged (kept) message ----
insert into pgtap_output select is(
  (select content from reveal_reported_message('a8000000-0000-0000-0002-000000000001')),
  'hello from reported',
  'an admin revealing a message-linked report gets the message content'
);

-- ---- the admin reveals a report whose message was already deleted ----
insert into pgtap_output select is(
  (select content from reveal_reported_message('a8000000-0000-0000-0002-000000000003')),
  null,
  'revealing a report whose message was deleted returns null content'
);

reset role;

-- ---- post-condition, checked as postgres: exactly one logged reveal ----
insert into pgtap_output select is(
  (select count(*)::int from report_message_reveals where report_id = 'a8000000-0000-0000-0002-000000000001'),
  1,
  'exactly one reveal was logged for the one call against that report'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
