-- ============================================
-- 0068_fix_leave_trigger_double_leave_regression.sql
--
-- 0067's fix compared new.left_at to old.left_at BY VALUE to detect a
-- genuine leave attempt vs. an unrelated update (like mark_group_read's
-- last_read_at bump) — broken by a subtlety pgTAP's own leave-group test
-- caught immediately: Postgres's now() returns the same value for the
-- entire transaction, not fresh per call. Inside one transaction (exactly
-- what a pgTAP test — and any single mark_group_read() call re-attempting
-- an already-completed leave — runs in), a second "leave" attempt's
-- `left_at = now()` equals the first one's, so `IS DISTINCT FROM` saw them
-- as identical and silently let the double-leave through instead of
-- raising.
--
-- Fix: stop comparing values. old.left_at IS NOT NULL is already an
-- unconditional "already left" signal on its own (as the original 0048
-- trigger correctly used) — no need to also check what new.left_at is.
-- The only new case to handle is old.left_at IS NULL with new.left_at
-- ALSO staying null (mark_group_read never touches the column at all) —
-- that's the one case that isn't a leave attempt and shouldn't hit the
-- event-timing gate.
-- ============================================

create or replace function enforce_group_member_leave_only()
returns trigger
language plpgsql
as $$
declare
  event_time timestamptz;
begin
  if old.left_at is not null then
    raise exception 'already left this group';
  end if;

  if new.left_at is null then
    new.group_id := old.group_id;
    new.booking_id := old.booking_id;
    return new;
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
