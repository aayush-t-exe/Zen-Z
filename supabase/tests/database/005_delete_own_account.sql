-- ============================================
-- 005_delete_own_account.sql
-- Milestone 19: Testing.
--
-- delete_own_account() (0045_delete_own_account.sql) refuses to run while
-- the student has a paid booking that hasn't resolved yet (pending_match
-- or matched) — there's no backfill/refund flow for pulling one member
-- out of a forming/confirmed group. Otherwise it scrubs PII on profiles
-- (keeping the row so bookings/reports/no_shows RESTRICT FKs stay
-- satisfied), cancels any leftover unpaid pending_match booking, and bans
-- the auth identity so the student can't sign back in as themselves.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/005_delete_own_account.sql
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(6);

-- ---- fixtures ----
insert into auth.users (id, email) values
  ('a5000000-0000-0000-0000-000000000001', 'pgtap-del-blocked@test.local'),
  ('a5000000-0000-0000-0000-000000000002', 'pgtap-del-clean@test.local');

update profiles set full_name = 'DEL Blocked', photo_url = 'profile-photos/a5000000-0000-0000-0000-000000000001/photo.jpg'
  where id = 'a5000000-0000-0000-0000-000000000001';
update profiles set full_name = 'DEL Clean', photo_url = 'profile-photos/a5000000-0000-0000-0000-000000000002/photo.jpg'
  where id = 'a5000000-0000-0000-0000-000000000002';

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90005, 'pgtap DEL Cafe', 2, 2);
insert into slots (id, activity_type_id, slot_datetime)
  values ('b5000000-0000-0000-0000-000000000001', 90005, now() + interval '3 days');

-- Blocked student: paid, still pending_match — nobody's been seated with
-- them yet, but their money's committed to the slot.
insert into bookings (id, user_id, slot_id, status, payment_status, group_preference) values
  ('e5000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001',
    'b5000000-0000-0000-0000-000000000001', 'pending_match', 'paid', 'mixed');

-- Clean student: an unpaid pending_match booking with nothing to protect.
insert into bookings (id, user_id, slot_id, status, payment_status, group_preference) values
  ('e5000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000002',
    'b5000000-0000-0000-0000-000000000001', 'pending_match', 'unpaid', 'mixed');

-- ---- blocked student tries to delete ----
select set_config('request.jwt.claims', json_build_object('sub', 'a5000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$select delete_own_account()$$,
  null, null,
  'delete_own_account rejects a student with a paid, unresolved booking'
);

-- ---- clean student deletes ----
reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a5000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select lives_ok(
  $$select delete_own_account()$$,
  'delete_own_account succeeds for a student with only an unpaid booking'
);

-- ---- post-conditions, checked as postgres ----
reset role;

insert into pgtap_output select is(
  (select full_name from profiles where id = 'a5000000-0000-0000-0000-000000000002'),
  'Deleted user',
  'profile PII is scrubbed after deletion'
);

insert into pgtap_output select is(
  (select photo_url from profiles where id = 'a5000000-0000-0000-0000-000000000002'),
  null,
  'photo_url is cleared after deletion'
);

insert into pgtap_output select is(
  (select status from bookings where id = 'e5000000-0000-0000-0000-000000000002'),
  'cancelled',
  'the leftover unpaid booking is cancelled on deletion'
);

-- auth.users.email must also be scrubbed, not just profiles.email — the
-- original address needs to be free for a brand-new signup, and GoTrue
-- enforces uniqueness on auth.users.email regardless of ban status
-- (0085_delete_account_scrub_auth_email.sql).
insert into pgtap_output select is(
  (select email from auth.users where id = 'a5000000-0000-0000-0000-000000000002'),
  'deleted-a5000000-0000-0000-0000-000000000002@deleted.zen-z.internal',
  'auth.users.email is scrubbed so the real address can be reused'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
