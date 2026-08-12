-- ============================================
-- 0005_seed_slots.sql
-- Seed activity types and weekly fixed slots
-- for Café, Dinner, Movie bookings.
-- ============================================

-- Insert activity types
insert into activity_types (name, emoji, is_live, min_group_size, max_group_size)
values
  ('Café', '☕', true, 4, 5),
  ('Dinner', '🍽', true, 4, 5),
  ('Movie', '🎬', true, 4, 5)
on conflict do nothing;

-- Insert fixed weekly slots (recurring every week)
-- Wednesday slots: 7:00 PM (cafe & dinner), 8:00 PM (movie)
-- Saturday slots: 8:00 PM (cafe & dinner), 9:00 PM (movie)
-- Generate 4 weeks of slots starting from next Wednesday

do $$
declare
  cafe_id int;
  dinner_id int;
  movie_id int;
  base_date date;
  week_offset int;
begin
  -- Get activity type IDs
  select id into cafe_id from activity_types where name = 'Café' limit 1;
  select id into dinner_id from activity_types where name = 'Dinner' limit 1;
  select id into movie_id from activity_types where name = 'Movie' limit 1;

  -- Start from the next Wednesday (or today if today is Wednesday)
  base_date := current_date + (3 - (extract(dow from current_date)::int + 6) % 7);

  -- Generate 4 weeks of slots
  for week_offset in 0..3 loop
    -- Wednesday Cafés @ 7:00 PM IST
    insert into slots (activity_type_id, slot_datetime, status)
    values (cafe_id, make_timestamptz(
      extract(year from base_date + (week_offset * 7))::int,
      extract(month from base_date + (week_offset * 7))::int,
      extract(day from base_date + (week_offset * 7))::int,
      19, 0, 0, '+05:30'
    ), 'open');

    -- Wednesday Dinners @ 7:00 PM IST
    insert into slots (activity_type_id, slot_datetime, status)
    values (dinner_id, make_timestamptz(
      extract(year from base_date + (week_offset * 7))::int,
      extract(month from base_date + (week_offset * 7))::int,
      extract(day from base_date + (week_offset * 7))::int,
      19, 0, 0, '+05:30'
    ), 'open');

    -- Wednesday Movies @ 8:00 PM IST
    insert into slots (activity_type_id, slot_datetime, status)
    values (movie_id, make_timestamptz(
      extract(year from base_date + (week_offset * 7))::int,
      extract(month from base_date + (week_offset * 7))::int,
      extract(day from base_date + (week_offset * 7))::int,
      20, 0, 0, '+05:30'
    ), 'open');

    -- Saturday Cafés @ 8:00 PM IST
    insert into slots (activity_type_id, slot_datetime, status)
    values (cafe_id, make_timestamptz(
      extract(year from base_date + (week_offset * 7) + 3)::int,
      extract(month from base_date + (week_offset * 7) + 3)::int,
      extract(day from base_date + (week_offset * 7) + 3)::int,
      20, 0, 0, '+05:30'
    ), 'open');

    -- Saturday Dinners @ 8:00 PM IST
    insert into slots (activity_type_id, slot_datetime, status)
    values (dinner_id, make_timestamptz(
      extract(year from base_date + (week_offset * 7) + 3)::int,
      extract(month from base_date + (week_offset * 7) + 3)::int,
      extract(day from base_date + (week_offset * 7) + 3)::int,
      20, 0, 0, '+05:30'
    ), 'open');

    -- Saturday Movies @ 9:00 PM IST
    insert into slots (activity_type_id, slot_datetime, status)
    values (movie_id, make_timestamptz(
      extract(year from base_date + (week_offset * 7) + 3)::int,
      extract(month from base_date + (week_offset * 7) + 3)::int,
      extract(day from base_date + (week_offset * 7) + 3)::int,
      21, 0, 0, '+05:30'
    ), 'open');
  end loop;
end $$;
