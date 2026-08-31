-- ============================================
-- 013_payu_reference_lookup.sql
-- Part of the Razorpay -> PayU cutover.
--
-- slot_id_for_payment_reference() (0069) is a SECURITY DEFINER function
-- crossing bookings' owner+admin-only RLS wall (locked since 0059) so the
-- unauthenticated marketing redirect bridge can look up which slot a
-- payment attempt belongs to from our own minted payment_id. This proves
-- it returns the right slot_id for a known reference, returns null (not
-- an error) for a bogus one, and that its scalar-uuid return type can't
-- be abused to leak any other bookings column.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/013_payu_reference_lookup.sql
-- Everything happens inside a rolled-back transaction — no fixture data
-- is left behind in the dev project.
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(3);

-- ---- fixtures (run as postgres, which bypasses RLS) ----
insert into auth.users (id, email) values
  ('c1000000-0000-0000-0000-000000000401', 'pgtap-prl-a@test.local');

update profiles set full_name = 'Prl Student' where id = 'c1000000-0000-0000-0000-000000000401';

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90013, 'pgtap Prl Cafe', 2, 4);
insert into slots (id, activity_type_id, slot_datetime) values
  ('d1000000-0000-0000-0000-000000000401', 90013, now() + interval '5 days');

insert into bookings (id, user_id, slot_id, status, payment_status, payment_id, budget_band, group_preference)
  values ('e1000000-0000-0000-0000-000000000401', 'c1000000-0000-0000-0000-000000000401',
    'd1000000-0000-0000-0000-000000000401', 'pending_match', 'unpaid', 'txn_pgtap_prl_401', 'medium', 'mixed');

-- ---- simulate the unauthenticated redirect bridge's session ----
set local role anon;

insert into pgtap_output select is(
  slot_id_for_payment_reference('txn_pgtap_prl_401'),
  'd1000000-0000-0000-0000-000000000401'::uuid,
  'an anonymous caller resolves the right slot_id from a known payment reference'
);

insert into pgtap_output select is(
  slot_id_for_payment_reference('txn_does_not_exist'),
  null,
  'a bogus payment reference returns null, not an error'
);

insert into pgtap_output select is(
  pg_typeof(slot_id_for_payment_reference('txn_pgtap_prl_401'))::text,
  'uuid',
  'the function''s scalar uuid return type structurally cannot leak user_id/payment_status/booking id alongside it'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
