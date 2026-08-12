-- ============================================
-- 0008_confirm_group_function.sql
--
-- Milestone 13 Phase 2 (matching board): "Book Venue" is a hard commit —
-- it creates the group, assigns every member, and flips their bookings
-- to matched. Doing that as three separate client-side writes risks a
-- half-written group if a later step fails (e.g. group created but
-- group_members insert fails). Wrapping it in one plpgsql function makes
-- it a single transaction: all or nothing.
--
-- security invoker (not definer) — RLS on groups/group_members/bookings
-- still applies to the calling user, so only an admin can successfully
-- run this; it adds no privilege a normal RLS-checked call wouldn't have.
-- Group size and slot/status validation is re-checked server-side too,
-- since the client-side checks are UX only, not the source of truth.
-- ============================================

create or replace function confirm_group(
  p_slot_id uuid,
  p_venue_id uuid,
  p_booking_ids uuid[]
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_group_id uuid;
  v_booking_count int;
  v_min_size int;
  v_max_size int;
begin
  if p_booking_ids is null or array_length(p_booking_ids, 1) is null then
    raise exception 'confirm_group requires at least one booking';
  end if;

  select count(*) into v_booking_count
  from bookings
  where id = any(p_booking_ids) and slot_id = p_slot_id and status = 'pending_match';

  if v_booking_count <> array_length(p_booking_ids, 1) then
    raise exception 'One or more bookings are not pending_match for this slot';
  end if;

  select a.min_group_size, a.max_group_size into v_min_size, v_max_size
  from slots s join activity_types a on a.id = s.activity_type_id
  where s.id = p_slot_id;

  if v_booking_count < v_min_size or v_booking_count > v_max_size then
    raise exception 'Group size % is outside the allowed range % - %', v_booking_count, v_min_size, v_max_size;
  end if;

  if p_venue_id is null then
    raise exception 'A venue is required to confirm a group';
  end if;

  insert into groups (slot_id, venue_id, status, formed_by)
  values (p_slot_id, p_venue_id, 'confirmed', auth.uid())
  returning id into v_group_id;

  insert into group_members (group_id, booking_id)
  select v_group_id, b.id from unnest(p_booking_ids) as b(id);

  update bookings set status = 'matched' where id = any(p_booking_ids);

  return v_group_id;
end;
$$;

grant execute on function confirm_group(uuid, uuid, uuid[]) to authenticated;
