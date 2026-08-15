-- ============================================
-- 0023_confirm_group_gender_gate.sql
-- Milestone 19: Testing.
--
-- confirm_group() (0021_reports_moderation.sql) hard-gates payment status
-- and the reporter/reported blocklist at the DB level, but not
-- group_preference (women_only/men_only) or gender matching — that rule
-- only exists client-side in placementViolation()
-- (apps/admin/app/matching/MatchingBoard.tsx). A caller invoking this RPC
-- directly, bypassing the admin UI, could confirm a mismatched-gender
-- group. This adds the same hard gate confirm_group already enforces for
-- payment and the blocklist, mirroring placementViolation()'s semantics
-- exactly: a women_only/men_only preference from any booking in the group
-- requires every other booking in that same group to have the matching
-- gender.
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

  if exists (
    select 1
    from bookings b1
    join bookings b2 on b2.id = any(p_booking_ids) and b2.id <> b1.id
    join reports r on r.reporter_id = b1.user_id and r.reported_user_id = b2.user_id
    where b1.id = any(p_booking_ids)
  ) then
    raise exception 'This group would place a student with someone they have reported';
  end if;

  if exists (
    select 1
    from bookings b_pref
    join bookings b_other on b_other.id = any(p_booking_ids) and b_other.id <> b_pref.id
    join profiles p_other on p_other.id = b_other.user_id
    where b_pref.id = any(p_booking_ids)
      and (
        (b_pref.group_preference = 'women_only' and p_other.gender is distinct from 'female')
        or (b_pref.group_preference = 'men_only' and p_other.gender is distinct from 'male')
      )
  ) then
    raise exception 'This group violates a women-only/men-only preference constraint';
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
