-- ============================================
-- 0009_fix_group_members_rls_recursion.sql
--
-- "members read own group_members" (0001_init.sql) has a self-referential
-- subquery: its SELECT policy on group_members itself queries
-- group_members (aliased gm2) to find "other members of my group". Any
-- RLS-enforced read of group_members has to re-evaluate that same policy
-- for the inner gm2 query, which needs to evaluate the policy again,
-- without bound — Postgres raises "infinite recursion detected in
-- policy for relation group_members".
--
-- This was dormant since 0001_init.sql because nothing had ever read or
-- written group_members under real RLS enforcement: 0007 only just added
-- the admin write policy, and confirm_group (0008) does
-- `insert into groups (...) returning id`, which — under the
-- `authenticated` role — requires checking groups' own SELECT policy
-- ("members read own groups"), which queries group_members, which trips
-- the recursive policy for the first time. (Testing this migration with
-- the service_role key never caught it, because service_role bypasses
-- RLS entirely and skips the buggy policy rewrite altogether — only a
-- real `authenticated` session exercises it.) Same category of bug 0002
-- already fixed once for profiles.
--
-- Fix: move the "which groups is this user in" lookup into a
-- security-definer function. It's owned by the migration role (postgres,
-- which bypasses RLS), so its internal query against group_members does
-- not re-trigger group_members' own policy — breaking the cycle.
-- search_path is pinned per Postgres's security-definer hardening
-- guidance, to stop a caller from hijacking resolution via their own
-- search_path.
-- ============================================

drop policy if exists "members read own group_members" on group_members;

create or replace function my_group_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select gm.group_id
  from group_members gm
  join bookings b on b.id = gm.booking_id
  where b.user_id = auth.uid()
$$;

grant execute on function my_group_ids() to anon, authenticated, service_role;

create policy "members read own group_members" on group_members
  for select using (
    exists (select 1 from bookings b where b.id = group_members.booking_id and b.user_id = auth.uid())
    or group_id in (select my_group_ids())
  );
