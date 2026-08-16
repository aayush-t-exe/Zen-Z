-- ============================================
-- 001_photo_privacy.sql
-- Milestone 19: Testing.
--
-- Founder-only profile photos (CLAUDE.md, non-negotiable): no student ever
-- sees another student's photo, enforced at the RLS layer on `profiles`
-- and via the column-restricted, security-definer `group_member_public`
-- view (0022_groupmate_visibility_fix.sql). Run with:
--   npx supabase db query --linked -f supabase/tests/database/001_photo_privacy.sql
-- Everything happens inside a rolled-back transaction — no fixture data is
-- left behind in the dev project.
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(7);

-- ---- fixtures (run as postgres, which bypasses RLS) ----
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'pgtap-student-a@test.local'),
  ('a0000000-0000-0000-0000-000000000002', 'pgtap-student-b@test.local'),
  ('a0000000-0000-0000-0000-000000000003', 'pgtap-student-c@test.local'),
  ('a0000000-0000-0000-0000-000000000009', 'pgtap-admin@test.local');

update profiles set full_name = 'Student A', gender = 'female', year_of_study = 2,
  photo_url = 'profile-photos/a0000000-0000-0000-0000-000000000001/photo.jpg'
  where id = 'a0000000-0000-0000-0000-000000000001';
update profiles set full_name = 'Student B', gender = 'female', year_of_study = 3,
  photo_url = 'profile-photos/a0000000-0000-0000-0000-000000000002/photo.jpg'
  where id = 'a0000000-0000-0000-0000-000000000002';
update profiles set full_name = 'Student C', gender = 'female', year_of_study = 1,
  photo_url = 'profile-photos/a0000000-0000-0000-0000-000000000003/photo.jpg'
  where id = 'a0000000-0000-0000-0000-000000000003';

insert into admin_users (id) values ('a0000000-0000-0000-0000-000000000009');

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90001, 'pgtap Cafe', 2, 2);
insert into slots (id, activity_type_id, slot_datetime)
  values ('b0000000-0000-0000-0000-000000000001', 90001, now() + interval '3 days');
insert into venues (id, name, activity_type_id)
  values ('c0000000-0000-0000-0000-000000000001', 'pgtap Venue', 90001);
insert into groups (id, slot_id, venue_id, status)
  values ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001', 'confirmed');

insert into bookings (id, user_id, slot_id, status, payment_status) values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001', 'matched', 'paid'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000001', 'matched', 'paid');

insert into group_members (group_id, booking_id) values
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002');

-- ---- schema-level check: no session needed ----
insert into pgtap_output select columns_are('public', 'group_member_public', array['id', 'full_name', 'year_of_study']);

-- ---- simulate Student A's session ----
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select is(
  (select photo_url from profiles where id = 'a0000000-0000-0000-0000-000000000001'),
  'profile-photos/a0000000-0000-0000-0000-000000000001/photo.jpg',
  'student can read their own photo_url'
);

insert into pgtap_output select is(
  (select count(*)::int from profiles where id = 'a0000000-0000-0000-0000-000000000003'),
  0,
  'student cannot select an unrelated student''s profile row at all'
);

insert into pgtap_output select is(
  (select full_name from group_member_public where id = 'a0000000-0000-0000-0000-000000000002'),
  'Student B',
  'student CAN read a groupmate''s public info via group_member_public'
);

insert into pgtap_output select is(
  (select count(*)::int from group_member_public where id = 'a0000000-0000-0000-0000-000000000003'),
  0,
  'student cannot see an unrelated student via group_member_public (not a groupmate)'
);

insert into pgtap_output select table_privs_are('public', 'group_member_public', 'authenticated', array['SELECT']);

-- ---- reset to postgres, then simulate the admin's session ----
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000009', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select is(
  (select photo_url from profiles where id = 'a0000000-0000-0000-0000-000000000003'),
  'profile-photos/a0000000-0000-0000-0000-000000000003/photo.jpg',
  'admin can read any student''s photo_url'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
