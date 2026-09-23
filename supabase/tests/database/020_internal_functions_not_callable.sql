-- ============================================
-- 020_internal_functions_not_callable.sql
--
-- 0100 revoked EXECUTE on internal_delete_account() and the cron-only
-- SECURITY DEFINER functions from PUBLIC/anon/authenticated. This proves
-- a student (and an anonymous caller) can no longer reach them directly,
-- while the legitimate wrapper delete_own_account() still works.
--
-- Run with:
--   npx supabase db query --linked -f supabase/tests/database/020_internal_functions_not_callable.sql
-- Everything happens inside a rolled-back transaction — no fixture data
-- is left behind in the dev project.
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(11);

-- ---- privilege checks ----
insert into pgtap_output select ok(
  not has_function_privilege('anon', 'public.internal_delete_account(uuid)', 'execute'),
  'anon cannot execute internal_delete_account'
);
insert into pgtap_output select ok(
  not has_function_privilege('authenticated', 'public.internal_delete_account(uuid)', 'execute'),
  'authenticated cannot execute internal_delete_account'
);
insert into pgtap_output select ok(
  not has_function_privilege('anon', 'public.ensure_next_slot(text, integer, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.ensure_next_slot(text, integer, integer, integer)', 'execute'),
  'neither anon nor authenticated can execute ensure_next_slot'
);
insert into pgtap_output select ok(
  not has_function_privilege('anon', 'public.enqueue_scheduled_notifications()', 'execute')
  and not has_function_privilege('authenticated', 'public.enqueue_scheduled_notifications()', 'execute'),
  'neither anon nor authenticated can execute enqueue_scheduled_notifications'
);
insert into pgtap_output select ok(
  not has_function_privilege('anon', 'public.post_venue_reveal_messages()', 'execute')
  and not has_function_privilege('authenticated', 'public.post_venue_reveal_messages()', 'execute'),
  'neither anon nor authenticated can execute post_venue_reveal_messages'
);
insert into pgtap_output select ok(
  has_function_privilege('authenticated', 'public.delete_own_account()', 'execute')
  and has_function_privilege('authenticated', 'public.admin_delete_account(uuid)', 'execute'),
  'the legitimate wrappers are still callable by authenticated'
);

-- ---- fixtures (run as postgres, which bypasses RLS) ----
insert into auth.users (id, email) values
  ('ad000000-0000-0000-0000-000000000301', 'pgtap-ifn-attacker@test.local'),
  ('ad000000-0000-0000-0000-000000000302', 'pgtap-ifn-victim@test.local');

-- ---- an authenticated student tries to delete someone else directly ----
select set_config('request.jwt.claims',
  json_build_object('sub', 'ad000000-0000-0000-0000-000000000301', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$select internal_delete_account('ad000000-0000-0000-0000-000000000302')$$,
  '42501', null,
  'a student calling internal_delete_account on another user gets permission denied'
);

reset role;

insert into pgtap_output select is(
  (select deleted_at from profiles where id = 'ad000000-0000-0000-0000-000000000302'),
  null,
  'the victim''s profile is untouched'
);

-- ---- an anonymous caller tries the same ----
select set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
set local role anon;

insert into pgtap_output select throws_ok(
  $$select internal_delete_account('ad000000-0000-0000-0000-000000000302')$$,
  '42501', null,
  'an anonymous caller gets permission denied'
);

reset role;

-- ---- the legitimate self-delete path still works through the wrapper ----
select set_config('request.jwt.claims',
  json_build_object('sub', 'ad000000-0000-0000-0000-000000000301', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select lives_ok(
  $$select delete_own_account()$$,
  'delete_own_account() still reaches internal_delete_account via its definer rights'
);

reset role;

insert into pgtap_output select isnt(
  (select deleted_at from profiles where id = 'ad000000-0000-0000-0000-000000000301'),
  null,
  'the self-deleting student''s profile is marked deleted'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
