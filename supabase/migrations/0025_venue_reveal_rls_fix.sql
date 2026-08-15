-- ============================================
-- 0025_venue_reveal_rls_fix.sql
-- Milestone 19: Testing.
--
-- `venues` has RLS enabled (0007_close_rls_gaps.sql) with only an
-- admin-managed policy ("admin manage venues") — no policy has ever let a
-- student read a venue row. `my_group_details` (0018_group_reveal_and_chat.sql)
-- is security_invoker, so its `left join venues v on v.id = g.venue_id`
-- runs under the calling student's own RLS: with no student-facing venues
-- policy, that join has always silently returned a null venue for every
-- student, at every point — before AND after the 48h reveal gate passes.
-- apps/mobile/src/lib/groups.ts queries `my_group_details` directly for
-- venue_name/venue_address, so the reveal feature from Milestone 15 has
-- never actually surfaced a venue to a student in this environment.
--
-- Fix: let a student read a venue row only when it's attached to one of
-- their own confirmed groups AND that group's reveal gate has passed —
-- the same boundary my_group_details itself already computes, reusing
-- the existing my_group_ids() security-definer helper (0009) so this
-- doesn't re-open the group_members recursion bug.
-- ============================================

create policy "members read own revealed venue" on venues
  for select using (
    exists (
      select 1
      from groups g
      join slots s on s.id = g.slot_id
      where g.venue_id = venues.id
        and g.id in (select my_group_ids())
        and now() >= s.reveal_venue_at
    )
  );
