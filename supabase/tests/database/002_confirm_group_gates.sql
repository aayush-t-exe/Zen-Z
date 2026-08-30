-- ============================================
-- 002_confirm_group_gates.sql
-- Milestone 19: Testing.
--
-- confirm_group() (0021_reports_moderation.sql, hardened further in
-- 0023_confirm_group_gender_gate.sql) is the single place group membership
-- is actually committed, and hard-gates: payment status, the
-- reporter/reported blocklist, and group_preference/gender matching. Each
-- gate is tested here by calling the RPC directly (as an authenticated
-- admin), the same way a client bypassing the admin UI would, to prove the
-- gate is enforced server-side and not just in MatchingBoard.tsx.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/002_confirm_group_gates.sql
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(4);

-- ---- fixtures ----
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000001', 'pgtap-cg-a@test.local'),
  ('a1000000-0000-0000-0000-000000000002', 'pgtap-cg-b@test.local'),
  ('a1000000-0000-0000-0000-000000000003', 'pgtap-cg-c@test.local'),
  ('a1000000-0000-0000-0000-000000000004', 'pgtap-cg-d@test.local'),
  ('a1000000-0000-0000-0000-000000000009', 'pgtap-cg-admin@test.local');

update profiles set full_name = 'CG Student A', gender = 'female' where id = 'a1000000-0000-0000-0000-000000000001';
update profiles set full_name = 'CG Student B', gender = 'male'   where id = 'a1000000-0000-0000-0000-000000000002';
update profiles set full_name = 'CG Student C', gender = 'female' where id = 'a1000000-0000-0000-0000-000000000003';
update profiles set full_name = 'CG Student D', gender = 'female' where id = 'a1000000-0000-0000-0000-000000000004';

insert into admin_users (id) values ('a1000000-0000-0000-0000-000000000009');

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90002, 'pgtap CG Cafe', 2, 2);
-- One slot per gate — bookings_user_slot_active_unique (0054) now means a
-- student can only hold one active booking per slot, and several students
-- here are reused across gates (e.g. Student A in Gate 1, Gate 3, and the
-- happy path), so each scenario needs its own slot just as it would for a
-- real student booking distinct weeks.
insert into slots (id, activity_type_id, slot_datetime) values
  ('b1000000-0000-0000-0000-000000000001', 90002, now() + interval '3 days'),
  ('b1000000-0000-0000-0000-000000000002', 90002, now() + interval '3 days'),
  ('b1000000-0000-0000-0000-000000000003', 90002, now() + interval '3 days'),
  ('b1000000-0000-0000-0000-000000000004', 90002, now() + interval '3 days');
insert into venues (id, name, activity_type_id)
  values ('c1000000-0000-0000-0000-000000000001', 'pgtap CG Venue', 90002);

-- Gate 1: unpaid booking
insert into bookings (id, user_id, slot_id, status, payment_status, group_preference) values
  ('e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001', 'pending_match', 'paid', 'mixed'),
  ('e1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000001', 'pending_match', 'unpaid', 'mixed');

-- Gate 2: reported pair (both paid, no gender conflict)
insert into bookings (id, user_id, slot_id, status, payment_status, group_preference) values
  ('e1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003',
    'b1000000-0000-0000-0000-000000000002', 'pending_match', 'paid', 'mixed'),
  ('e1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004',
    'b1000000-0000-0000-0000-000000000002', 'pending_match', 'paid', 'mixed');
insert into reports (reporter_id, reported_user_id, status) values
  ('a1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004', 'open');

-- Gate 3: mismatched women_only group (A is female/women_only, B is male, both paid)
insert into bookings (id, user_id, slot_id, status, payment_status, group_preference) values
  ('e1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000003', 'pending_match', 'paid', 'women_only'),
  ('e1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000003', 'pending_match', 'paid', 'mixed');

-- Happy path: two paid, un-reported, gender-compatible women_only bookings
insert into bookings (id, user_id, slot_id, status, payment_status, group_preference) values
  ('e1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000004', 'pending_match', 'paid', 'women_only'),
  ('e1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000003',
    'b1000000-0000-0000-0000-000000000004', 'pending_match', 'paid', 'mixed');

-- ---- simulate the admin's session (confirm_group is security invoker) ----
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000009', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$select confirm_group('b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
      array['e1000000-0000-0000-0000-000000000001'::uuid, 'e1000000-0000-0000-0000-000000000002'::uuid])$$,
  null, null,
  'confirm_group rejects a group containing an unpaid booking'
);

insert into pgtap_output select throws_ok(
  $$select confirm_group('b1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
      array['e1000000-0000-0000-0000-000000000003'::uuid, 'e1000000-0000-0000-0000-000000000004'::uuid])$$,
  null, null,
  'confirm_group rejects a group where one student has reported the other'
);

insert into pgtap_output select throws_ok(
  $$select confirm_group('b1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001',
      array['e1000000-0000-0000-0000-000000000005'::uuid, 'e1000000-0000-0000-0000-000000000006'::uuid])$$,
  null, null,
  'confirm_group rejects a women_only group containing a male booking, even via direct RPC call'
);

insert into pgtap_output select lives_ok(
  $$select confirm_group('b1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001',
      array['e1000000-0000-0000-0000-000000000007'::uuid, 'e1000000-0000-0000-0000-000000000008'::uuid])$$,
  'confirm_group succeeds for a paid, un-reported, gender-compatible women_only group'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
