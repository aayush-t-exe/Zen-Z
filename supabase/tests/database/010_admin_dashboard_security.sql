-- ============================================
-- 010_admin_dashboard_security.sql
-- Milestone 19: Testing (Area 8 — Admin Dashboard).
--
-- confirm_group() (0021_reports_moderation.sql onward) never explicitly
-- checked the caller was an admin — it relied on the side effect that its
-- own internal count query is scoped by bookings' "own bookings" RLS, so a
-- non-admin could never assemble a *multi*-booking p_booking_ids array that
-- passes the count check. That's incidental: a min_group_size=1 activity
-- type (nothing prevented one) lets a non-admin pass every other gate using
-- only their own single booking. 0058_confirm_group_admin_check.sql adds an
-- explicit check; this proves both that a non-admin is now rejected via
-- that exact path, and that a real admin is unaffected.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/010_admin_dashboard_security.sql
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(2);

-- ---- fixtures ----
insert into auth.users (id, email) values
  ('a1000000-0000-0000-0000-000000000101', 'pgtap-adm-student@test.local'),
  ('a1000000-0000-0000-0000-000000000102', 'pgtap-adm-admin@test.local');

update profiles set full_name = 'ADM Student' where id = 'a1000000-0000-0000-0000-000000000101';
insert into admin_users (id) values ('a1000000-0000-0000-0000-000000000102');

-- min_group_size=1 activity type: nothing in the schema prevents one, and
-- it's the smallest fixture that lets a single self-owned booking pass
-- every other gate in confirm_group() on its own.
insert into activity_types (id, name, min_group_size, max_group_size)
  values (90010, 'pgtap ADM Solo Cafe', 1, 1);
insert into venues (id, name, activity_type_id)
  values ('c1000000-0000-0000-0000-000000000101', 'pgtap ADM Venue', 90010);
insert into slots (id, activity_type_id, slot_datetime) values
  ('b1000000-0000-0000-0000-000000000101', 90010, now() + interval '3 days'),
  ('b1000000-0000-0000-0000-000000000102', 90010, now() + interval '3 days');

insert into bookings (id, user_id, slot_id, status, payment_status, group_preference) values
  ('e1000000-0000-0000-0000-000000000101', 'a1000000-0000-0000-0000-000000000101',
    'b1000000-0000-0000-0000-000000000101', 'pending_match', 'paid', 'mixed'),
  ('e1000000-0000-0000-0000-000000000102', 'a1000000-0000-0000-0000-000000000101',
    'b1000000-0000-0000-0000-000000000102', 'pending_match', 'paid', 'mixed');

-- ---- simulate the student's own session (non-admin) ----
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000101', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$select confirm_group('b1000000-0000-0000-0000-000000000101', 'c1000000-0000-0000-0000-000000000101',
      array['e1000000-0000-0000-0000-000000000101'::uuid])$$,
  null, null,
  'a non-admin cannot self-confirm their own group, even one that would pass every other gate'
);

-- ---- simulate the admin's session ----
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-0000-0000-000000000102', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select lives_ok(
  $$select confirm_group('b1000000-0000-0000-0000-000000000102', 'c1000000-0000-0000-0000-000000000101',
      array['e1000000-0000-0000-0000-000000000102'::uuid])$$,
  'an admin can still confirm a group after the explicit admin check was added'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
