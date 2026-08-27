-- ============================================
-- 0039_booking_cutoff_and_slot_rollover.sql
--
-- Two gaps found while reasoning through same-day bookings: (1) nothing
-- stopped a student from booking a slot minutes before it started, leaving
-- the founder no runway to manually match a group of 4-5 or lock a venue
-- before reveal_venue_at (slot_datetime - 2h); (2) nothing regenerated a
-- slot's next weekly occurrence once it passed — 0033 permanently trimmed
-- each activity down to a single upcoming slot, but the "next" slot after
-- that one only ever appeared via a hand-written migration (0011, 0014).
--
-- Founder decision (2026-08-25): 24-hour minimum booking lead time, and
-- automate rollover now rather than keep depending on manual migrations.
-- ============================================

-- ---- 1. Booking cutoff ----
-- Bookings are inserted directly from the mobile client via supabase-js
-- (no create-booking Edge Function — see 0020's note), so RLS is the only
-- server-side checkpoint. Extending the same policy 0020 already uses for
-- the no-show block, rather than adding a second overlapping policy.
drop policy "own bookings insert" on bookings;
create policy "own bookings insert" on bookings
  for insert with check (
    auth.uid() = user_id
    and not exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.booking_blocked_until is not null
        and p.booking_blocked_until > now()
    )
    and exists (
      select 1 from slots s
      where s.id = slot_id
        and s.slot_datetime > now() + interval '24 hours'
    )
  );

-- ---- 2. Slot rollover ----
-- Cafés/Dinners/Movies are each down to a single weekly fixed day+time
-- (Sunday 5PM / Saturday 7PM / Tuesday 8PM IST — see 0011, 0014). Sports is
-- deliberately excluded: per docs/PRODUCT_SPEC.md §1.5a, its one-off slots
-- are meant to require a founder migration to add another, not auto-reseed.
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
begin
  select id into v_activity_id from activity_types where name = p_activity_name limit 1;
  if v_activity_id is null then
    return;
  end if;

  -- Already has a bookable slot ahead of it — nothing to do.
  if exists (
    select 1 from slots
    where activity_type_id = v_activity_id
      and status = 'open'
      and slot_datetime > now()
  ) then
    return;
  end if;

  v_candidate := make_timestamptz(
    extract(year from current_date)::int,
    extract(month from current_date)::int,
    extract(day from current_date)::int,
    p_hour, p_minute, 0, '+05:30'
  ) + ((p_target_dow - extract(dow from current_date)::int + 7) % 7) * interval '1 day';

  -- The modulo above can land on "today" even after today's occurrence has
  -- already passed (e.g. it's Tuesday 9PM and the 8PM slot just closed) —
  -- push to next week rather than insert an already-past slot.
  if v_candidate <= now() then
    v_candidate := v_candidate + interval '7 days';
  end if;

  insert into slots (activity_type_id, slot_datetime, status)
  values (v_activity_id, v_candidate, 'open');
end;
$$;

create or replace function run_slot_rollover()
returns void
language plpgsql
as $$
begin
  perform ensure_next_slot('Cafés', 0, 17, 0);   -- Sunday 5:00 PM IST
  perform ensure_next_slot('Dinners', 6, 19, 0); -- Saturday 7:00 PM IST
  perform ensure_next_slot('Movies', 2, 20, 0);  -- Tuesday 8:00 PM IST
end;
$$;

create extension if not exists pg_cron;

select cron.schedule(
  'slot-rollover',
  '0 * * * *',
  $$select run_slot_rollover();$$
);
