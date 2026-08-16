-- ============================================
-- 004_no_show_block.sql
-- Milestone 19: Testing.
--
-- No-show strike policy (0020_no_show_strikes.sql): 3 un-punished no-shows
-- apply booking_blocked_until = now() + 7 days, enforced at booking
-- creation via the "own bookings insert" policy on `bookings` — the only
-- server-side checkpoint, since bookings are inserted directly from the
-- mobile client.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/004_no_show_block.sql
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(2);

-- ---- fixtures ----
insert into auth.users (id, email) values
  ('a3000000-0000-0000-0000-000000000001', 'pgtap-ns-a@test.local');

update profiles set full_name = 'NS Student A' where id = 'a3000000-0000-0000-0000-000000000001';

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90004, 'pgtap NS Cafe', 2, 2);
insert into slots (id, activity_type_id, slot_datetime)
  values ('b3000000-0000-0000-0000-000000000001', 90004, now() + interval '3 days');

-- Bypass the (revoked-from-authenticated) column lock, as postgres, to put
-- the student under an active block.
update profiles
  set booking_blocked_until = now() + interval '7 days'
  where id = 'a3000000-0000-0000-0000-000000000001';

-- ---- simulate the blocked student's session ----
select set_config('request.jwt.claims', json_build_object('sub', 'a3000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$insert into bookings (user_id, slot_id, group_preference) values ('a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'mixed')$$,
  null, null,
  'a booking insert is rejected while booking_blocked_until is in the future'
);

-- ---- lift the block, as postgres, then retry as the same student ----
reset role;
update profiles set booking_blocked_until = now() - interval '1 minute'
  where id = 'a3000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claims', json_build_object('sub', 'a3000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select lives_ok(
  $$insert into bookings (user_id, slot_id, group_preference) values ('a3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'mixed')$$,
  'a booking insert succeeds once booking_blocked_until is in the past'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
