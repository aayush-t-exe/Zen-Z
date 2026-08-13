-- ============================================
-- 0011_reschedule_movies_to_tuesday.sql
--
-- Movies move to a dedicated Tuesday slot, distinct from the Wed/Sat
-- cadence Cafés and Dinners keep — Tuesday is the founder's chosen day
-- for movies specifically (discounted per-seat pricing in Jaipur on
-- Tuesdays). Deletes the previously-seeded Wed/Sat movie slots (all
-- confirmed unbooked before writing this migration) and seeds 4
-- upcoming Tuesdays at 8:00 PM IST instead — enough buffer that at
-- least 3 upcoming Tuesdays are always available between reseeds.
-- ============================================

delete from slots
where activity_type_id in (select id from activity_types where name in ('Movie', 'Movies'))
  and status = 'open';

do $$
declare
  movie_id int;
  base_date date;
  week_offset int;
begin
  select id into movie_id from activity_types where name = 'Movie' limit 1;

  -- Next Tuesday on/after today.
  base_date := current_date + (2 - extract(dow from current_date)::int + 7) % 7;

  for week_offset in 0..3 loop
    insert into slots (activity_type_id, slot_datetime, status)
    values (movie_id, make_timestamptz(
      extract(year from base_date + (week_offset * 7))::int,
      extract(month from base_date + (week_offset * 7))::int,
      extract(day from base_date + (week_offset * 7))::int,
      20, 0, 0, '+05:30'
    ), 'open');
  end loop;
end $$;
