-- ============================================
-- 0071_admin_add_group_member.sql
--
-- Companion to admin_cancel_booking (0070): lets the founder fill a seat
-- that opened up in an already-confirmed group, instead of the group
-- being stuck at a smaller size or needing to be rebuilt from scratch.
--
-- Only a pending_match, paid booking for the SAME slot as the group can
-- be added — a different slot means a different date/time, which is
-- physically meaningless to add. The same hard gates confirm_group()
-- (0021_reports_moderation.sql) and the matching board's
-- placementViolation() already enforce for a brand-new group apply here
-- too: a women_only/men_only preference from either side constrains the
-- whole group, and the reporter/reported blocklist is permanent and
-- order-independent. Skipping these here just because the group already
-- exists would be a real safety regression, not a shortcut.
--
-- Reuses enqueue_group_matched() (0019, AFTER INSERT ON group_members,
-- fires per row) for free — the newly-added student gets the exact same
-- "group matched" notification anyone placed via confirm_group() gets,
-- no separate copy needed for them. The already-there members get a new
-- 'group_member_joined' notification instead (widening
-- notifications_outbox_type_check again, same pattern as 0066/0070) —
-- [ASSUMPTION] provisional copy, no existing microcopy-table entry for
-- this, same caveat 0070's group_member_left had.
--
-- security definer for the same reasons as 0070: authenticated has no
-- write access to group_members/notifications_outbox for other users,
-- and the admin check itself needs to run before anything else.
-- ============================================

alter table notifications_outbox
  drop constraint notifications_outbox_type_check;
alter table notifications_outbox
  add constraint notifications_outbox_type_check
  check (type in (
    'booking_confirmed', 'group_matched', 'venue_reveal',
    'event_reminder_2h', 'post_event_feedback', 'no_show', 'new_message',
    'group_member_left', 'group_member_joined'
  ));

create or replace function admin_add_group_member(p_group_id uuid, p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_slot_id uuid;
  v_max_group_size int;
  v_current_count int;
  v_booking_status text;
  v_booking_payment_status text;
  v_booking_slot_id uuid;
  v_new_user_id uuid;
  v_new_group_preference text;
  v_new_gender text;
  v_required_gender text;
  v_title text;
  v_body text;
begin
  if not (select exists(select 1 from admin_users where id = auth.uid())) then
    raise exception 'Only admins can add someone to a group';
  end if;

  select slot_id into v_group_slot_id from groups where id = p_group_id;
  if v_group_slot_id is null then
    raise exception 'Group not found';
  end if;

  select b.status, b.payment_status, b.slot_id, b.user_id, b.group_preference, p.gender
    into v_booking_status, v_booking_payment_status, v_booking_slot_id, v_new_user_id, v_new_group_preference, v_new_gender
  from bookings b
  join profiles p on p.id = b.user_id
  where b.id = p_booking_id;

  if v_booking_status is null then
    raise exception 'Booking not found';
  end if;
  if v_booking_status <> 'pending_match' then
    raise exception 'This booking is not available to add — it is already %', v_booking_status;
  end if;
  if v_booking_payment_status <> 'paid' then
    raise exception 'This booking has not been paid for yet';
  end if;
  if v_booking_slot_id <> v_group_slot_id then
    raise exception 'This booking is for a different slot than the group''s';
  end if;

  select at.max_group_size into v_max_group_size
  from groups g
  join slots s on s.id = g.slot_id
  join activity_types at on at.id = s.activity_type_id
  where g.id = p_group_id;

  select count(*) into v_current_count from group_members where group_id = p_group_id;
  if v_current_count >= v_max_group_size then
    raise exception 'This group is already at its max size of %', v_max_group_size;
  end if;

  select
    case
      when bool_or(existing_b.group_preference = 'women_only') then 'female'
      when bool_or(existing_b.group_preference = 'men_only') then 'male'
    end
  into v_required_gender
  from group_members gm
  join bookings existing_b on existing_b.id = gm.booking_id
  where gm.group_id = p_group_id;

  if v_required_gender is not null and v_new_gender is distinct from v_required_gender then
    raise exception 'This group is %-only', (case when v_required_gender = 'female' then 'women' else 'men' end);
  end if;

  if v_new_group_preference = 'women_only' and exists (
    select 1 from group_members gm
    join bookings existing_b on existing_b.id = gm.booking_id
    join profiles existing_p on existing_p.id = existing_b.user_id
    where gm.group_id = p_group_id and existing_p.gender is distinct from 'female'
  ) then
    raise exception 'This student wants a women-only group, which the existing members don''t match';
  end if;

  if v_new_group_preference = 'men_only' and exists (
    select 1 from group_members gm
    join bookings existing_b on existing_b.id = gm.booking_id
    join profiles existing_p on existing_p.id = existing_b.user_id
    where gm.group_id = p_group_id and existing_p.gender is distinct from 'male'
  ) then
    raise exception 'This student wants a men-only group, which the existing members don''t match';
  end if;

  if exists (
    select 1
    from group_members gm
    join bookings existing_b on existing_b.id = gm.booking_id
    join reports r on (
      (r.reporter_id = v_new_user_id and r.reported_user_id = existing_b.user_id)
      or (r.reporter_id = existing_b.user_id and r.reported_user_id = v_new_user_id)
    )
    where gm.group_id = p_group_id
  ) then
    raise exception 'This student can''t be placed with an existing member — one has reported the other';
  end if;

  -- enqueue_group_matched() (0019) fires automatically off this insert
  -- (AFTER INSERT ON group_members, per row) and notifies the new member
  -- themselves — no separate copy needed for them here.
  insert into group_members (group_id, booking_id) values (p_group_id, p_booking_id);

  select a.name || ', ' || to_char(s.slot_datetime at time zone 'Asia/Kolkata', 'Dy HH12:MI AM')
           || ' — someone new just joined your group.'
  into v_body
  from groups g
  join slots s on s.id = g.slot_id
  join activity_types a on a.id = s.activity_type_id
  where g.id = p_group_id;
  v_title := 'Your group just changed.';

  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  select existing_b.user_id, 'group_member_joined', p_group_id, v_title, v_body,
         jsonb_build_object('groupId', p_group_id)
  from group_members gm
  join bookings existing_b on existing_b.id = gm.booking_id
  where gm.group_id = p_group_id
    and gm.booking_id != p_booking_id
  on conflict (type, user_id, reference_id) do nothing;
end;
$$;

grant execute on function admin_add_group_member(uuid, uuid) to authenticated;
