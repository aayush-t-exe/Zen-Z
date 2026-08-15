-- ============================================
-- 0022_groupmate_visibility_fix.sql
-- Milestone 19: Testing.
--
-- 0001_init.sql created a "members read groupmate public info" policy on
-- profiles so group_member_public (the photo-free view the mobile app
-- queries for match-reveal/chat member info — never `profiles` directly,
-- see apps/mobile/src/lib/groups.ts) would actually return other members'
-- name/year. 0002_fix_rls_recursion.sql dropped that policy to kill an
-- infinite-recursion bug and was never revisited — 0018's comment
-- incorrectly claims groupmate visibility is "already true today, via the
-- ... policy from 0001_init.sql, untouched here." As of 0021, profiles only
-- allows self-read + admin-read, so groupmates currently see nothing via
-- group_member_public: a functional regression, not a photo leak.
--
-- The fix is NOT to simply recreate that dropped policy. RLS is row-level,
-- not column-level: any policy granting a groupmate SELECT on a teammate's
-- `profiles` row also grants raw `photo_url` on that row to anyone querying
-- `profiles` directly, bypassing group_member_public's column list
-- entirely. Per CLAUDE.md's founder-only-photo rule, that would be a
-- security bug, not a style choice — reintroducing it isn't an option even
-- to fix a regression, so `profiles`' own policies (self, admin) are left
-- untouched here.
--
-- Instead, group_member_public itself is switched from security_invoker
-- (runs under the caller's own `profiles` RLS, which is exactly what
-- returns nothing for other members) to security-definer-style: it bypasses
-- `profiles` RLS the same way `my_group_ids()` (0009) already bypasses
-- `group_members`' RLS, and does its own auth.uid()-scoped filtering in the
-- view body via a new `groupmate_user_ids()` helper — so no base-table
-- grant to see a groupmate's row (including photo_url) is ever created.
--
-- The view's own DML grants are also tightened to SELECT-only: with
-- security_invoker off, an UPDATE/INSERT/DELETE through this (auto-
-- updatable, single-table) view would write straight to `profiles` without
-- going through its RLS — previously harmless only because invoker-mode
-- RLS blocked it anyway. That protection is gone once the view runs as its
-- owner, so the write grants must be revoked explicitly rather than relied
-- on implicitly.
-- ============================================

create or replace function groupmate_user_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select b.user_id
  from group_members gm
  join bookings b on b.id = gm.booking_id
  where gm.group_id in (select my_group_ids())
$$;

grant execute on function groupmate_user_ids() to authenticated;

drop view group_member_public;

create view group_member_public
with (security_invoker = false) as
select id, full_name, year_of_study
from profiles
where id in (select groupmate_user_ids());

revoke insert, update, delete, truncate, references, trigger
  on group_member_public from anon, authenticated;
grant select on group_member_public to anon, authenticated;
