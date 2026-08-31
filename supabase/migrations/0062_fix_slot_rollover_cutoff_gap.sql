-- ============================================
-- 0062_fix_slot_rollover_cutoff_gap.sql
--
-- Bug found live on dev (2026-08-27 db_now): Cafés/Dinners/every Sports game
-- had zero bookable slots even though `slots` had an "open" row in the
-- future for each of them. ensure_next_slot()'s "already covered" check
-- (0039) only tested `slot_datetime > now()`, which was true right up until
-- the slot's own start time. But 0044 later moved the actual booking
-- cutoff to 3 calendar days out (midnight IST) — so for the ~1-3 days
-- between a slot crossing that cutoff and it actually starting, the
-- rollover job saw "covered" and skipped creating the next week's slot,
-- leaving a real gap with nothing bookable. Movies happened to be spared
-- only because its Tuesday slot was still >3 days out at the time.
--
-- Fix: match the "covered" check to the same cutoff the "own bookings
-- insert" RLS policy and the mobile client actually use, and base the next
-- candidate off the latest existing slot for that activity (any status)
-- rather than recomputing from today's date — recomputing from today would
-- land back on the same still-open date once that slot enters the cutoff
-- window (same weekday, same week) and attempt a duplicate insert instead
-- of advancing to next week.
-- ============================================

create or replace function ensure_next_slot(
  p_activity_name text,
  p_target_dow int,
  p_hour int,
  p_minute int
)
returns void
language plpgsql
security definer
as $$
declare
  v_activity_id int;
  v_candidate timestamptz;
  v_latest timestamptz;
begin
  select id into v_activity_id from activity_types where name = p_activity_name limit 1;
  if v_activity_id is null then
    return;
  end if;

  -- Already has a slot still inside the bookable window (mirrors the
  -- midnight-IST, 3-calendar-days-out cutoff from 0044) — nothing to do.
  -- A slot that's still technically in the future but has aged past that
  -- cutoff no longer counts as "covered".
  if exists (
    select 1 from slots
    where activity_type_id = v_activity_id
      and status = 'open'
      and slot_datetime >= (
        date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '3 days'
      ) at time zone 'Asia/Kolkata'
  ) then
    return;
  end if;

  select max(slot_datetime) into v_latest
  from slots
  where activity_type_id = v_activity_id;

  if v_latest is not null then
    -- Every rollover-managed activity holds exactly one slot at a time on a
    -- fixed weekly day/time (0033), so the latest existing slot is already
    -- on the right weekday — just step forward one week from it.
    v_candidate := v_latest + interval '7 days';
  else
    v_candidate := make_timestamptz(
      extract(year from current_date)::int,
      extract(month from current_date)::int,
      extract(day from current_date)::int,
      p_hour, p_minute, 0, '+05:30'
    ) + ((p_target_dow - extract(dow from current_date)::int + 7) % 7) * interval '1 day';

    if v_candidate <= now() then
      v_candidate := v_candidate + interval '7 days';
    end if;
  end if;

  insert into slots (activity_type_id, slot_datetime, status)
  values (v_activity_id, v_candidate, 'open');
end;
$$;

-- Backfill: run the fixed job immediately so the currently-empty activities
-- (Cafés, Dinners, all four Sports games) get their next bookable slot
-- without waiting for the next hourly cron tick.
select run_slot_rollover();
