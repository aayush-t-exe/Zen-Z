-- ============================================
-- 0065_group_member_ids_bypass_bookings_rls.sql
--
-- Bug: fetchGroupMembers() (apps/mobile/src/lib/groups.ts) resolved a
-- group's member user_ids by embedding a join through bookings
-- (`group_members.select('bookings:booking_id(user_id)')`). group_members'
-- own RLS (0009) correctly returns every row in a caller's group, but the
-- embedded `bookings` join is independently subject to bookings' "own
-- bookings" policy (auth.uid() = user_id, 0001_init.sql) — which only
-- lets a user read their *own* booking row. PostgREST resolves a blocked
-- embedded resource as null, so every groupmate's booking (and therefore
-- their user_id) silently came back null and got dropped by the client's
-- .filter(Boolean) — leaving only the caller's own id. That's why a
-- student only ever saw their own name/details, in both the reveal screen
-- and chat (memberName()'s "Someone" fallback for every other sender).
--
-- Opening bookings itself to groupmate reads is not the fix — that table
-- also carries payment_status/budget_band/payment_id, and RLS is
-- row-level, not column-level, so any such policy would leak all of it.
-- Same shape as groupmate_user_ids() (0022) for the analogous profiles
-- problem: a SECURITY DEFINER function that does the group_members/
-- bookings join internally (bypassing bookings' RLS the way the migration
-- role already does), returning only the user_ids, scoped to a group the
-- caller is actually a member of.
-- ============================================

create or replace function group_member_ids(p_group_id uuid)
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select b.user_id
  from group_members gm
  join bookings b on b.id = gm.booking_id
  where gm.group_id = p_group_id
    and p_group_id in (select my_group_ids())
$$;

grant execute on function group_member_ids(uuid) to authenticated;
