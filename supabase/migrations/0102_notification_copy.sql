-- ============================================
-- 0102_notification_copy.sql
--
-- Founder decision (2026-09-28): notification wording moves off the old
-- "invitation / story / mystery" voice onto the plain, honest voice the
-- Content Constitution set for social on 2026-09-05. Only the strings change;
-- every function below is its live definition with the wording swapped.
--
-- Also fixes slot times printing with a leading zero ("Sat 05:00 PM"):
-- slot_label() gives "Sat 5 PM", or "Sat 5:30 PM" when there are minutes.
-- ============================================

create or replace function slot_time_label(p_at timestamptz)
returns text
language sql
stable
set search_path = public
as $$
  select case
           when extract(minute from p_at at time zone 'Asia/Kolkata') = 0
             then to_char(p_at at time zone 'Asia/Kolkata', 'FMHH12 AM')
           else to_char(p_at at time zone 'Asia/Kolkata', 'FMHH12:MI AM')
         end;
$$;

create or replace function slot_label(p_at timestamptz)
returns text
language sql
stable
set search_path = public
as $$
  select to_char(p_at at time zone 'Asia/Kolkata', 'Dy') || ' ' || slot_time_label(p_at);
$$;

CREATE OR REPLACE FUNCTION public.enqueue_booking_confirmed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_title text;
  v_body text;
begin
  if new.payment_status <> 'paid' or old.payment_status = 'paid' then
    return new;
  end if;

  select 'You''re in for ' || a.name || '.',
         slot_label(s.slot_datetime) || '. We''ll tell you when your table is set.'
  into v_title, v_body
  from slots s join activity_types a on a.id = s.activity_type_id
  where s.id = new.slot_id;

  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  values (new.user_id, 'booking_confirmed', new.id, v_title, v_body,
          jsonb_build_object('bookingId', new.id))
  on conflict (type, user_id, reference_id) do nothing;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_group_matched()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_group_status text;
  v_user_id uuid;
begin
  select status into v_group_status from groups where id = new.group_id;
  if v_group_status <> 'confirmed' then
    return new;
  end if;

  select user_id into v_user_id from bookings where id = new.booking_id;

  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  values (
    v_user_id, 'group_matched', new.group_id,
    'Your table is set.',
    'See who you''re sitting with.',
    jsonb_build_object('groupId', new.group_id)
  )
  on conflict (type, user_id, reference_id) do nothing;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_no_show()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  values (
    new.user_id, 'no_show', new.booking_id,
    'You missed tonight.',
    'It counts as a no-show. Here''s what that means.',
    jsonb_build_object('bookingId', new.booking_id)
  )
  on conflict (type, user_id, reference_id) do nothing;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_scheduled_notifications()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  -- Venue reveal: the existing 48h reveal_venue_at boundary from 0018.
  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  select b.user_id, 'venue_reveal', g.id,
         'Here''s where you''re going.',
         'Your group chat is open too. Say hi before you meet.',
         jsonb_build_object('groupId', g.id)
  from groups g
  join slots s on s.id = g.slot_id
  join group_members gm on gm.group_id = g.id
  join bookings b on b.id = gm.booking_id
  where g.status = 'confirmed' and now() >= s.reveal_venue_at
  on conflict (type, user_id, reference_id) do nothing;

  -- 2h-before-event reminder.
  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  select b.user_id, 'event_reminder_2h', b.id,
         '2 hours to go.',
         a.name || ' at ' || slot_time_label(s.slot_datetime) || '. Running late? Tell your group in the chat.',
         jsonb_build_object('bookingId', b.id)
  from bookings b
  join slots s on s.id = b.slot_id
  join activity_types a on a.id = s.activity_type_id
  where b.status = 'matched' and s.slot_datetime - now() <= interval '2 hours'
  on conflict (type, user_id, reference_id) do nothing;

  -- Post-event feedback prompt, 3h after the slot started.
  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  select b.user_id, 'post_event_feedback', b.id,
         'How was it?',
         'Tell us on WhatsApp. It helps us build a better table next time.',
         jsonb_build_object('bookingId', b.id)
  from bookings b
  join slots s on s.id = b.slot_id
  where b.status = 'matched' and now() >= s.slot_datetime + interval '3 hours'
  on conflict (type, user_id, reference_id) do nothing;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_cancel_booking(p_booking_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status text;
  v_group_id uuid;
  v_title text;
  v_body text;
begin
  if not (select exists(select 1 from admin_users where id = auth.uid())) then
    raise exception 'Only admins can cancel a booking';
  end if;

  select status into v_status from bookings where id = p_booking_id;
  if v_status is null then
    raise exception 'Booking not found';
  end if;
  if v_status = 'cancelled' then
    raise exception 'This booking is already cancelled';
  end if;

  -- A pending_match booking is never in a group; a matched one always has
  -- exactly one group_members row (one booking per group, per confirm_group).
  select group_id into v_group_id
  from group_members
  where booking_id = p_booking_id;

  if v_group_id is not null then
    select 'Someone dropped out.',
           a.name || ', ' || slot_label(s.slot_datetime) || ' is still on.'
    into v_title, v_body
    from groups g
    join slots s on s.id = g.slot_id
    join activity_types a on a.id = s.activity_type_id
    where g.id = v_group_id;

    -- Notify everyone left in the group except the person being
    -- cancelled — they're the one losing their spot, not gaining news of
    -- someone else leaving.
    insert into notifications_outbox (user_id, type, reference_id, title, body, data)
    select b.user_id, 'group_member_left', v_group_id, v_title, v_body,
           jsonb_build_object('groupId', v_group_id)
    from group_members gm
    join bookings b on b.id = gm.booking_id
    where gm.group_id = v_group_id
      and gm.booking_id != p_booking_id
    on conflict (type, user_id, reference_id) do nothing;

    delete from group_members where booking_id = p_booking_id;
  end if;

  update referral_credits
  set status = 'available', consumed_booking_id = null, consumed_at = null
  where consumed_booking_id = p_booking_id;

  update bookings set status = 'cancelled' where id = p_booking_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_add_group_member(p_group_id uuid, p_booking_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_group_slot_id uuid;
  v_max_group_size int;
  v_current_seats int;
  v_new_seats int;
  v_booking_status text;
  v_booking_payment_status text;
  v_booking_slot_id uuid;
  v_new_user_id uuid;
  v_new_group_preference text;
  v_new_plus_one boolean;
  v_new_movie_id uuid;
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

  select b.status, b.payment_status, b.slot_id, b.user_id, b.group_preference, b.plus_one, b.movie_id, p.gender
    into v_booking_status, v_booking_payment_status, v_booking_slot_id, v_new_user_id, v_new_group_preference, v_new_plus_one, v_new_movie_id, v_new_gender
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

  select coalesce(sum(case when b.plus_one then 2 else 1 end), 0) into v_current_seats
  from group_members gm
  join bookings b on b.id = gm.booking_id
  where gm.group_id = p_group_id;

  v_new_seats := case when v_new_plus_one then 2 else 1 end;

  if v_current_seats + v_new_seats > v_max_group_size then
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

  if v_new_movie_id is not null and exists (
    select 1 from group_members gm
    join bookings existing_b on existing_b.id = gm.booking_id
    where gm.group_id = p_group_id
      and existing_b.movie_id is not null
      and existing_b.movie_id <> v_new_movie_id
  ) then
    raise exception 'This student chose a different movie than an existing member';
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

  select a.name || ', ' || slot_label(s.slot_datetime) || '.'
  into v_body
  from groups g
  join slots s on s.id = g.slot_id
  join activity_types a on a.id = s.activity_type_id
  where g.id = p_group_id;
  v_title := 'Someone new joined your table.';

  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  select existing_b.user_id, 'group_member_joined', p_group_id, v_title, v_body,
         jsonb_build_object('groupId', p_group_id)
  from group_members gm
  join bookings existing_b on existing_b.id = gm.booking_id
  where gm.group_id = p_group_id
    and gm.booking_id != p_booking_id
  on conflict (type, user_id, reference_id) do nothing;
end;
$function$;

CREATE OR REPLACE FUNCTION public.post_venue_reveal_messages()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_location text;
  v_maps_url text;
begin
  for r in
    update groups g
    set venue_message_sent_at = now()
    from slots s, venues v
    where g.slot_id = s.id
      and g.venue_id = v.id
      and g.status = 'confirmed'
      and g.venue_id is not null
      and now() >= s.reveal_venue_at
      and g.venue_message_sent_at is null
    returning g.id as group_id, v.name as venue_name, v.address as venue_address, v.maps_url as venue_maps_url
  loop
    v_location := r.venue_name || coalesce(', ' || r.venue_address, '');
    v_maps_url := coalesce(
      nullif(r.venue_maps_url, ''),
      'https://www.google.com/maps/search/?api=1&query=' || url_encode(v_location)
    );

    insert into messages (group_id, sender_id, content, is_system, data)
    values (
      r.group_id,
      null,
      'Here''s where you''re meeting: ' || v_location,
      true,
      jsonb_build_object('kind', 'venue_reveal', 'mapsUrl', v_maps_url)
    );
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.grant_referral_reward()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_code text;
  v_owner_id uuid;
  v_redemption_id uuid;
begin
  if new.payment_id = 'free' then
    return new;
  end if;

  select referred_by_code into v_code from profiles where id = new.user_id;
  if v_code is null then
    return new;
  end if;

  insert into referral_redemptions (code, referred_user_id)
  values (v_code, new.user_id)
  on conflict (referred_user_id) do nothing
  returning id into v_redemption_id;

  if v_redemption_id is null then
    return new;
  end if;

  select owner_id into v_owner_id from referrals where code = v_code;

  insert into referral_credits (owner_id, redemption_id) values (v_owner_id, v_redemption_id);

  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  values (v_owner_id, 'referral_reward_earned', v_redemption_id,
          'Your friend booked. ₹21 off for you.',
          'It comes off your next Movie or Sports game automatically.',
          jsonb_build_object('redemptionId', v_redemption_id))
  on conflict (type, user_id, reference_id) do nothing;

  return new;
end;
$function$;
