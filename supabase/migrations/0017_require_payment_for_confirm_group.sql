-- ============================================
-- 0017_require_payment_for_confirm_group.sql
--
-- confirm_group() checked booking status and group size but never
-- payment_status — a founder could (and, before this migration, would
-- have to be trusted not to) confirm a group of entirely unpaid
-- bookings. Adds payment_status = 'paid' to the same existence check
-- that already validates status = 'pending_match', so a booking that
-- hasn't been paid for simply doesn't count toward the group at all.
-- Everything else about the function is unchanged from
-- 0008_confirm_group_function.sql.
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
  where id = any(p_booking_ids)
    and slot_id = p_slot_id
    and status = 'pending_match'
    and payment_status = 'paid';

  if v_booking_count <> array_length(p_booking_ids, 1) then
    raise exception 'One or more bookings are not pending_match and paid for this slot';
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
