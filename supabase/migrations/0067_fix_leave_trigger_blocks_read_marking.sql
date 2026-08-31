-- ============================================
-- 0067_fix_leave_trigger_blocks_read_marking.sql
--
-- Bug found live while testing 0066: enforce_group_member_leave_only()
-- (0048) is a plain BEFORE UPDATE trigger with no WHEN clause — it fires
-- on every update to group_members regardless of which column is actually
-- changing or which function performed it (triggers aren't gated by RLS
-- policy, so even mark_group_read()'s SECURITY DEFINER update goes
-- through it). It unconditionally applied the "can't leave before the
-- meet has happened" rule to mark_group_read()'s last_read_at bump too,
-- since that's a plain "leave" trigger with no concept of any other kind
-- of update to this table existing.
--
-- Fix: only apply leave semantics (the already-left/event-timing checks,
-- forcing left_at := now()) when left_at is actually the column being
-- changed. An update that leaves left_at untouched isn't a leave attempt.
-- ============================================

create or replace function enforce_group_member_leave_only()
returns trigger
language plpgsql
as $$
declare
  event_time timestamptz;
begin
  if new.left_at is not distinct from old.left_at then
    new.group_id := old.group_id;
    new.booking_id := old.booking_id;
    return new;
  end if;

  if old.left_at is not null then
    raise exception 'already left this group';
  end if;

  select s.slot_datetime into event_time
  from groups g join slots s on s.id = g.slot_id
  where g.id = old.group_id;

  if event_time is null or now() < event_time then
    raise exception 'cannot leave a group before the meet has happened';
  end if;

  new.group_id := old.group_id;
  new.booking_id := old.booking_id;
  new.left_at := now();

  return new;
end;
$$;
