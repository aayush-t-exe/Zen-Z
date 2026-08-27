-- ============================================
-- 009_report_and_message_integrity.sql
-- Milestone 19: Testing.
--
-- Two fixes from the 2026-08-27 audit:
-- 1. submitReport() (apps/mobile/src/lib/reports.ts) previously omitted
--    reporter_id from its insert entirely, so every report a student
--    tried to file was silently rejected by "users create reports"
--    (0001_init.sql: with check (auth.uid() = reporter_id)) — the report
--    feature was completely non-functional. Fixed client-side; this locks
--    in that the RLS policy itself was always correct (rejects a missing/
--    mismatched reporter_id, accepts a correctly-supplied one).
-- 2. "group members send messages after reveal" (0018) never constrained
--    is_system, so a direct insert could spoof an unattributed system
--    line. Fixed in 0055_messages_insert_no_system_spoof.sql.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/009_report_and_message_integrity.sql
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(4);

-- ---- fixtures ----
insert into auth.users (id, email) values
  ('a9000000-0000-0000-0000-000000000001', 'pgtap-ri-a@test.local'),
  ('a9000000-0000-0000-0000-000000000002', 'pgtap-ri-b@test.local');

update profiles set full_name = 'RI Student A' where id = 'a9000000-0000-0000-0000-000000000001';
update profiles set full_name = 'RI Student B' where id = 'a9000000-0000-0000-0000-000000000002';

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90009, 'pgtap RI Cafe', 2, 2);
insert into venues (id, name, activity_type_id)
  values ('c9000000-0000-0000-0000-000000000001', 'pgtap RI Venue', 90009);

-- Slot 1 day out -> reveal_venue_at is ~1 day in the past (already revealed),
-- so the message-insert cases below aren't blocked by the reveal gate
-- itself — only by the is_system check under test.
insert into slots (id, activity_type_id, slot_datetime)
  values ('b9000000-0000-0000-0000-000000000001', 90009, now() + interval '1 day');

insert into groups (id, slot_id, venue_id, status)
  values ('d9000000-0000-0000-0000-000000000001', 'b9000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000001', 'confirmed');

insert into bookings (id, user_id, slot_id, status, payment_status) values
  ('e9000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000001', 'b9000000-0000-0000-0000-000000000001', 'matched', 'paid'),
  ('e9000000-0000-0000-0000-000000000002', 'a9000000-0000-0000-0000-000000000002', 'b9000000-0000-0000-0000-000000000001', 'matched', 'paid');

insert into group_members (group_id, booking_id) values
  ('d9000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000001'),
  ('d9000000-0000-0000-0000-000000000001', 'e9000000-0000-0000-0000-000000000002');

-- ---- simulate Student A's session ----
select set_config('request.jwt.claims', json_build_object('sub', 'a9000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select lives_ok(
  $$insert into reports (reporter_id, reported_user_id, group_id, reason) values ('a9000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000002', 'd9000000-0000-0000-0000-000000000001', 'Made me uncomfortable')$$,
  'a report insert with the real reporter_id set succeeds (the actual fix)'
);

insert into pgtap_output select throws_ok(
  $$insert into reports (reported_user_id, group_id, reason) values ('a9000000-0000-0000-0000-000000000002', 'd9000000-0000-0000-0000-000000000001', 'Made me uncomfortable')$$,
  null, null,
  'a report insert with no reporter_id (the pre-fix bug''s exact payload) is still rejected by RLS'
);

insert into pgtap_output select lives_ok(
  $$insert into messages (group_id, sender_id, content) values ('d9000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000001', 'a normal message')$$,
  'a normal (is_system=false) message from a group member still succeeds'
);

insert into pgtap_output select throws_ok(
  $$insert into messages (group_id, sender_id, content, is_system) values ('d9000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000001', 'fake announcement', true)$$,
  null, null,
  'a student cannot spoof is_system=true on their own message'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
