-- ============================================
-- 0014_reschedule_cafes_and_dinners.sql
--
-- Cafés move to a single weekly Sunday 5:00 PM IST slot; Dinners move
-- to a single weekly Saturday 7:00 PM IST slot (each replacing their
-- previous twice-weekly pattern). Seeds 3 upcoming occurrences of each,
-- matching Movies' single-weekly-day treatment from 0011.
--
-- Only deletes slots with zero bookings against them — one existing
-- Dinner slot has a confirmed group of real bookings and must not be
-- touched; using NOT EXISTS rather than a hardcoded id keeps this safe
-- regardless of which specific slot turns out to be booked.
-- ============================================

delete from slots s
where s.activity_type_id = (select id from activity_types where name = 'Cafés')
  and s.status = 'open'
  and not exists (select 1 from bookings b where b.slot_id = s.id);

delete from slots s
where s.activity_type_id = (select id from activity_types where name = 'Dinners')
  and s.status = 'open'
  and not exists (select 1 from bookings b where b.slot_id = s.id);

do $$
declare
  cafe_id int;
  dinner_id int;
  cafe_base_date date;
  dinner_base_date date;
  week_offset int;
begin
  select id into cafe_id from activity_types where name = 'Cafés' limit 1;
  select id into dinner_id from activity_types where name = 'Dinners' limit 1;

  -- Next Sunday (dow 0) on/after today, for Cafés.
  cafe_base_date := current_date + (0 - extract(dow from current_date)::int + 7) % 7;
  -- Next Saturday (dow 6) on/after today, for Dinners.
  dinner_base_date := current_date + (6 - extract(dow from current_date)::int + 7) % 7;

  for week_offset in 0..2 loop
    insert into slots (activity_type_id, slot_datetime, status)
    values (cafe_id, make_timestamptz(
      extract(year from cafe_base_date + (week_offset * 7))::int,
      extract(month from cafe_base_date + (week_offset * 7))::int,
      extract(day from cafe_base_date + (week_offset * 7))::int,
      17, 0, 0, '+05:30'
    ), 'open');

    insert into slots (activity_type_id, slot_datetime, status)
    values (dinner_id, make_timestamptz(
      extract(year from dinner_base_date + (week_offset * 7))::int,
      extract(month from dinner_base_date + (week_offset * 7))::int,
      extract(day from dinner_base_date + (week_offset * 7))::int,
      19, 0, 0, '+05:30'
    ), 'open');
  end loop;
end $$;
