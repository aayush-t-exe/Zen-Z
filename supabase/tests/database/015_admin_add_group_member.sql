-- ============================================
-- 015_admin_add_group_member.sql
--
-- admin_add_group_member() (0071) lets the founder fill a seat that
-- opened up in an already-confirmed group. This proves: non-admins are
-- rejected, a nonexistent group/booking raises, a booking for a
-- different slot is rejected, an unpaid booking is rejected, a
-- successful add both grows the group AND fires notifications for
-- everyone (the new member via the pre-existing group_matched trigger,
-- the already-there member via the new group_member_joined type),
-- exceeding max_group_size is rejected, and the same hard gates
-- confirm_group() enforces (gender preference, reporter/reported
-- blocklist) apply here too.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/015_admin_add_group_member.sql
-- Everything happens inside a rolled-back transaction — no fixture data
-- is left behind in the dev project.
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(11);

-- ---- fixtures (run as postgres, which bypasses RLS) ----
insert into auth.users (id, email) values
  ('ad000000-0000-0000-0000-000000000301', 'pgtap-aag-existing@test.local'),
  ('ad000000-0000-0000-0000-000000000302', 'pgtap-aag-candidate@test.local'),
  ('ad000000-0000-0000-0000-000000000303', 'pgtap-aag-otherslot@test.local'),
  ('ad000000-0000-0000-0000-000000000304', 'pgtap-aag-unpaid@test.local'),
  ('ad000000-0000-0000-0000-000000000305', 'pgtap-aag-overflow@test.local'),
  ('ad000000-0000-0000-0000-000000000306', 'pgtap-aag-womenonly-host@test.local'),
  ('ad000000-0000-0000-0000-000000000307', 'pgtap-aag-male-candidate@test.local'),
  ('ad000000-0000-0000-0000-000000000308', 'pgtap-aag-reporter@test.local'),
  ('ad000000-0000-0000-0000-000000000309', 'pgtap-aag-reported@test.local'),
  ('ad000000-0000-0000-0000-000000000310', 'pgtap-aag-admin@test.local');

update profiles set full_name = 'Aag Existing', gender = 'female' where id = 'ad000000-0000-0000-0000-000000000301';
update profiles set full_name = 'Aag Candidate', gender = 'female' where id = 'ad000000-0000-0000-0000-000000000302';
update profiles set full_name = 'Aag OtherSlot', gender = 'female' where id = 'ad000000-0000-0000-0000-000000000303';
update profiles set full_name = 'Aag Unpaid', gender = 'female' where id = 'ad000000-0000-0000-0000-000000000304';
update profiles set full_name = 'Aag Overflow', gender = 'female' where id = 'ad000000-0000-0000-0000-000000000305';
update profiles set full_name = 'Aag WomenOnlyHost', gender = 'female' where id = 'ad000000-0000-0000-0000-000000000306';
update profiles set full_name = 'Aag MaleCandidate', gender = 'male' where id = 'ad000000-0000-0000-0000-000000000307';
update profiles set full_name = 'Aag Reporter', gender = 'female' where id = 'ad000000-0000-0000-0000-000000000308';
update profiles set full_name = 'Aag Reported', gender = 'female' where id = 'ad000000-0000-0000-0000-000000000309';
insert into admin_users (id) values ('ad000000-0000-0000-0000-000000000310');

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90015, 'pgtap Aag Cafe', 1, 2);
insert into venues (id, name, activity_type_id)
  values ('ce000000-0000-0000-0000-000000000301', 'pgtap Aag Venue', 90015);
insert into slots (id, activity_type_id, slot_datetime) values
  ('be000000-0000-0000-0000-000000000301', 90015, now() + interval '5 days'),
  ('be000000-0000-0000-0000-000000000302', 90015, now() + interval '5 days');

-- Main group: one existing member, max_group_size 2 — room for exactly
-- one successful add before it's full.
insert into bookings (id, user_id, slot_id, status, payment_status, budget_band, group_preference)
  values ('ee000000-0000-0000-0000-000000000301', 'ad000000-0000-0000-0000-000000000301',
    'be000000-0000-0000-0000-000000000301', 'matched', 'paid', 'medium', 'mixed');
insert into groups (id, slot_id, venue_id, status)
  values ('de000000-0000-0000-0000-000000000301', 'be000000-0000-0000-0000-000000000301',
    'ce000000-0000-0000-0000-000000000301', 'confirmed');
insert into group_members (group_id, booking_id) values
  ('de000000-0000-0000-0000-000000000301', 'ee000000-0000-0000-0000-000000000301');

-- Candidates for the main group.
insert into bookings (id, user_id, slot_id, status, payment_status, budget_band, group_preference) values
  ('ee000000-0000-0000-0000-000000000302', 'ad000000-0000-0000-0000-000000000302',
    'be000000-0000-0000-0000-000000000301', 'pending_match', 'paid', 'medium', 'mixed'),
  ('ee000000-0000-0000-0000-000000000303', 'ad000000-0000-0000-0000-000000000303',
    'be000000-0000-0000-0000-000000000302', 'pending_match', 'paid', 'medium', 'mixed'),
  ('ee000000-0000-0000-0000-000000000304', 'ad000000-0000-0000-0000-000000000304',
    'be000000-0000-0000-0000-000000000301', 'pending_match', 'unpaid', 'medium', 'mixed'),
  ('ee000000-0000-0000-0000-000000000305', 'ad000000-0000-0000-0000-000000000305',
    'be000000-0000-0000-0000-000000000301', 'pending_match', 'paid', 'medium', 'mixed');

-- A second, women-only group to test the gender hard gate.
insert into bookings (id, user_id, slot_id, status, payment_status, budget_band, group_preference)
  values ('ee000000-0000-0000-0000-000000000306', 'ad000000-0000-0000-0000-000000000306',
    'be000000-0000-0000-0000-000000000301', 'matched', 'paid', 'medium', 'women_only');
insert into groups (id, slot_id, venue_id, status)
  values ('de000000-0000-0000-0000-000000000302', 'be000000-0000-0000-0000-000000000301',
    'ce000000-0000-0000-0000-000000000301', 'confirmed');
insert into group_members (group_id, booking_id) values
  ('de000000-0000-0000-0000-000000000302', 'ee000000-0000-0000-0000-000000000306');
insert into bookings (id, user_id, slot_id, status, payment_status, budget_band, group_preference)
  values ('ee000000-0000-0000-0000-000000000307', 'ad000000-0000-0000-0000-000000000307',
    'be000000-0000-0000-0000-000000000301', 'pending_match', 'paid', 'medium', 'mixed');

-- A third group + a reporter/reported pair to test the blocklist gate.
insert into bookings (id, user_id, slot_id, status, payment_status, budget_band, group_preference)
  values ('ee000000-0000-0000-0000-000000000308', 'ad000000-0000-0000-0000-000000000308',
    'be000000-0000-0000-0000-000000000301', 'matched', 'paid', 'medium', 'mixed');
insert into groups (id, slot_id, venue_id, status)
  values ('de000000-0000-0000-0000-000000000303', 'be000000-0000-0000-0000-000000000301',
    'ce000000-0000-0000-0000-000000000301', 'confirmed');
insert into group_members (group_id, booking_id) values
  ('de000000-0000-0000-0000-000000000303', 'ee000000-0000-0000-0000-000000000308');
insert into bookings (id, user_id, slot_id, status, payment_status, budget_band, group_preference)
  values ('ee000000-0000-0000-0000-000000000309', 'ad000000-0000-0000-0000-000000000309',
    'be000000-0000-0000-0000-000000000301', 'pending_match', 'paid', 'medium', 'mixed');
insert into reports (reporter_id, reported_user_id, reason)
  values ('ad000000-0000-0000-0000-000000000308', 'ad000000-0000-0000-0000-000000000309', 'pgtap fixture');

-- ---- simulate a non-admin's session ----
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000302', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$select admin_add_group_member('de000000-0000-0000-0000-000000000301', 'ee000000-0000-0000-0000-000000000302')$$,
  null, null,
  'a non-admin cannot add someone to a group'
);

-- ---- simulate the admin's session ----
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'ad000000-0000-0000-0000-000000000310', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$select admin_add_group_member('00000000-0000-0000-0000-000000000000', 'ee000000-0000-0000-0000-000000000302')$$,
  null, null,
  'adding to a group that does not exist raises'
);

insert into pgtap_output select throws_ok(
  $$select admin_add_group_member('de000000-0000-0000-0000-000000000301', 'ee000000-0000-0000-0000-000000000303')$$,
  null, null,
  'a booking for a different slot than the group cannot be added'
);

insert into pgtap_output select throws_ok(
  $$select admin_add_group_member('de000000-0000-0000-0000-000000000301', 'ee000000-0000-0000-0000-000000000304')$$,
  null, null,
  'an unpaid booking cannot be added'
);

insert into pgtap_output select lives_ok(
  $$select admin_add_group_member('de000000-0000-0000-0000-000000000301', 'ee000000-0000-0000-0000-000000000302')$$,
  'an admin can add a pending_match, paid booking for the same slot'
);

insert into pgtap_output select is(
  (select count(*)::int from group_members where group_id = 'de000000-0000-0000-0000-000000000301'),
  2,
  'the group now has both members'
);

insert into pgtap_output select is(
  (select count(*)::int from notifications_outbox
    where user_id = 'ad000000-0000-0000-0000-000000000302' and type = 'group_matched'
      and reference_id = 'de000000-0000-0000-0000-000000000301'),
  1,
  'the newly-added member gets the normal group_matched notification, via the pre-existing trigger'
);

insert into pgtap_output select is(
  (select count(*)::int from notifications_outbox
    where user_id = 'ad000000-0000-0000-0000-000000000301' and type = 'group_member_joined'
      and reference_id = 'de000000-0000-0000-0000-000000000301'),
  1,
  'the already-there member gets a group_member_joined notification'
);

insert into pgtap_output select throws_ok(
  $$select admin_add_group_member('de000000-0000-0000-0000-000000000301', 'ee000000-0000-0000-0000-000000000305')$$,
  null, null,
  'a third student cannot be added once the group is already at max_group_size'
);

insert into pgtap_output select throws_ok(
  $$select admin_add_group_member('de000000-0000-0000-0000-000000000302', 'ee000000-0000-0000-0000-000000000307')$$,
  null, null,
  'a male candidate cannot join a group whose existing member wants women-only'
);

insert into pgtap_output select throws_ok(
  $$select admin_add_group_member('de000000-0000-0000-0000-000000000303', 'ee000000-0000-0000-0000-000000000309')$$,
  null, null,
  'a candidate cannot join a group containing someone who reported them (or vice versa)'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
