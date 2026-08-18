-- ============================================
-- 0033_trim_future_slots_to_one_week.sql
--
-- Per the founder: Cafés, Dinners, and Movies should only ever show the
-- single nearest upcoming occurrence, not several weeks pre-seeded in
-- advance (0011/0014 had seeded 3-4 weeks ahead for each).
--
-- Same safe-delete pattern as 0014: only removes 'open' future slots
-- that have zero bookings against them, and never touches the one
-- nearest upcoming slot per activity (that's the one currently open for
-- booking) or anything already booked into.
-- ============================================

do $$
declare
  act record;
  keep_slot_id uuid;
begin
  for act in select id from activity_types where name in ('Cafés', 'Dinners', 'Movies') loop
    select s.id into keep_slot_id
    from slots s
    where s.activity_type_id = act.id
      and s.status = 'open'
      and s.slot_datetime > now()
    order by s.slot_datetime asc
    limit 1;

    delete from slots s
    where s.activity_type_id = act.id
      and s.status = 'open'
      and s.slot_datetime > now()
      and s.id is distinct from keep_slot_id
      and not exists (select 1 from bookings b where b.slot_id = s.id);
  end loop;
end $$;
