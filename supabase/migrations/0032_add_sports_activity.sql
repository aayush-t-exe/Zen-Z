-- ============================================
-- 0032_add_sports_activity.sql
--
-- Adds Sports as a fourth home-screen activity. Sports itself isn't
-- directly bookable — it's a category card that expands into four games
-- (Box Cricket, Football, 8-Ball Pool, Pickleball), each with its own
-- headcount range, duration, and price. Modelling each game as its own
-- activity_types row (not a separate table) means the existing booking
-- flow, matching board, and payment pipeline — all already generic over
-- activity_types.min_group_size/max_group_size/convenience_fee — work
-- for Sports with zero changes to the payment or matching logic.
--
-- Two new columns make this possible:
--   parent_activity_id — self-reference so the mobile home screen can
--     find "Sports"'s children without hardcoding their ids.
--   is_bookable — false only for the Sports parent row itself, which has
--     no slots of its own and must never appear as a selectable activity
--     in the admin matching/venues dropdowns.
--   duration_minutes — nullable; Café/Dinner/Movie leave it null (no
--     fixed duration was ever tracked for them), Sports games set it so
--     the booking summary can show "for 2 hrs".
--
-- Per the founder: Sports is a one-off trial for this coming Saturday
-- only, not a recurring weekly slot like the other three activities —
-- so this seeds exactly one slot per game and nothing generates more
-- automatically. Once that Saturday passes, Sports simply shows no
-- available slots until the founder deliberately adds another.
-- ============================================

alter table activity_types add column parent_activity_id int references activity_types(id);
alter table activity_types add column duration_minutes int;
alter table activity_types add column is_bookable boolean not null default true;

insert into activity_types (name, emoji, is_live, is_bookable, min_group_size, max_group_size)
values ('Sports', '🏆', true, false, 4, 5);

do $$
declare
  sports_id int;
  box_cricket_id int;
  football_id int;
  pool_id int;
  pickleball_id int;
  slot_date date;
begin
  select id into sports_id from activity_types where name = 'Sports' limit 1;

  insert into activity_types
    (name, emoji, is_live, is_bookable, parent_activity_id, min_group_size, max_group_size, duration_minutes, convenience_fee)
  values
    ('Box Cricket', '🏏', true, true, sports_id, 10, 14, 120, 221),
    ('Football',    '⚽', true, true, sports_id, 8,  14, 60,  221),
    ('8-Ball Pool', '🎱', true, true, sports_id, 4,  4,  60,  70),
    ('Pickleball',  '🏓', true, true, sports_id, 4,  4,  60,  129);

  select id into box_cricket_id from activity_types where name = 'Box Cricket' limit 1;
  select id into football_id    from activity_types where name = 'Football' limit 1;
  select id into pool_id        from activity_types where name = '8-Ball Pool' limit 1;
  select id into pickleball_id  from activity_types where name = 'Pickleball' limit 1;

  -- Next Saturday (dow 6) on/after today — one occurrence, not a range of weeks.
  slot_date := current_date + (6 - extract(dow from current_date)::int + 7) % 7;

  insert into slots (activity_type_id, slot_datetime, status)
  values
    (box_cricket_id, make_timestamptz(
      extract(year from slot_date)::int, extract(month from slot_date)::int, extract(day from slot_date)::int,
      18, 0, 0, '+05:30'), 'open'),
    (football_id, make_timestamptz(
      extract(year from slot_date)::int, extract(month from slot_date)::int, extract(day from slot_date)::int,
      18, 0, 0, '+05:30'), 'open'),
    (pool_id, make_timestamptz(
      extract(year from slot_date)::int, extract(month from slot_date)::int, extract(day from slot_date)::int,
      18, 0, 0, '+05:30'), 'open'),
    (pickleball_id, make_timestamptz(
      extract(year from slot_date)::int, extract(month from slot_date)::int, extract(day from slot_date)::int,
      18, 0, 0, '+05:30'), 'open');
end $$;
