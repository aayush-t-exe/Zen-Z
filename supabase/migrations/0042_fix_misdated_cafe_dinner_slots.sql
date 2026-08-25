-- 0041_fix_misdated_cafe_dinner_slots.sql
--
-- Cafés and Dinners each ended up with one open slot dated to a Tuesday
-- (matching Movies' weekday instead of their own Sunday/Saturday — see
-- 0011, 0014, 0039). Confirmed a mistake, not intentional. The Cafés one
-- already has 4 paid, matched bookings and a confirmed group with a venue
-- assigned — correcting slot_datetime in place, rather than deleting the
-- slot or moving those bookings/group rows, keeps all of that intact and
-- just fixes which calendar day it points at. The Dinners one is empty.
--
-- Any open Cafés/Dinners slot landing on a Tuesday (dow 2) is by
-- definition wrong for either activity, so this is safe to leave as a
-- general guard rather than only matching today's specific bad rows.

do $$
declare
  cafe_id int;
  dinner_id int;
begin
  select id into cafe_id from activity_types where name = 'Cafés';
  select id into dinner_id from activity_types where name = 'Dinners';

  update slots
  set slot_datetime = make_timestamptz(
    extract(year from current_date)::int,
    extract(month from current_date)::int,
    extract(day from current_date)::int,
    17, 0, 0, '+05:30'
  ) + ((0 - extract(dow from current_date)::int + 7) % 7) * interval '1 day'
  where activity_type_id = cafe_id
    and status = 'open'
    and extract(dow from slot_datetime) = 2;

  update slots
  set slot_datetime = make_timestamptz(
    extract(year from current_date)::int,
    extract(month from current_date)::int,
    extract(day from current_date)::int,
    19, 0, 0, '+05:30'
  ) + ((6 - extract(dow from current_date)::int + 7) % 7) * interval '1 day'
  where activity_type_id = dinner_id
    and status = 'open'
    and extract(dow from slot_datetime) = 2;
end $$;
