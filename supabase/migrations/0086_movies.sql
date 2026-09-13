-- ============================================
-- 0086_movies.sql
--
-- Movies-only feature: a student chooses between "Surprise me" (founder
-- picks the film per group, same manual-assignment pattern venues already
-- use) and "Choose your movie" (student picks from the currently-showing
-- list at booking time). A chosen movie becomes a hard matching constraint
-- exactly like group_preference (women_only/men_only) already is — two
-- choose_movie students who picked different films can never share a
-- group; surprise_me students (movie_id null) impose no constraint.
--
-- The founder's final pick for the whole group lives on groups.movie_id,
-- set at confirm_group() time exactly like groups.venue_id already is —
-- pre-filled from members' shared choice on the matching board, but always
-- overridable.
--
-- Screening stopped: movies.is_available is a soft-disable, never a
-- hard-delete (bookings/groups may already reference the row via FK). This
-- drops the title from future choose-your-movie bookings and from the
-- matching board's confirm-time select, without touching any booking that
-- already picked it — the founder just can't confirm a group into a pulled
-- screening any more, since the select (and the server-side check below)
-- won't offer/accept it.
--
-- [ASSUMPTION, not covered by existing docs]: a movie has no showtime
-- distinct from its slot's own time — `notes` stays freeform for anything
-- like genre/language/showtime. No minimum-headcount enforcement for a
-- choose_movie pick either — a lone student wanting an unpopular film can
-- only ever join a surprise_me group, same unmatchable-singleton risk
-- women_only/men_only already carries at low volume; the founder handles
-- it manually, same as today.
-- ============================================

create table movies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  activity_type_id int references activity_types(id),
  is_available boolean default true,
  notes text
);

alter table movies enable row level security;
-- Unlike venues (admin-only — students never query it directly, the
-- founder-assigned venue is only ever read through a time-gated reveal
-- view), students need to read the movie list directly during the
-- choose-your-movie booking step, before any match/payment/reveal gating
-- exists to hide it behind. Same shape as activity_types/slots instead.
create policy "anyone read movies" on movies
  for select using (true);
create policy "admin manage movies" on movies
  for all using (auth.uid() in (select id from admin_users));

alter table bookings add column movie_choice_type text
  check (movie_choice_type in ('surprise_me', 'choose_movie'));
alter table bookings add column movie_id uuid references movies(id);
alter table bookings add constraint bookings_movie_id_requires_choose_movie
  check (
    (movie_choice_type = 'choose_movie' and movie_id is not null)
    or (movie_choice_type is distinct from 'choose_movie' and movie_id is null)
  );

-- bookings' INSERT grant is column-restricted to exactly the columns
-- booking-flow.tsx sends (0059_bookings_column_grants.sql). Column grants
-- are additive, so this adds the two new columns without touching the
-- existing list.
grant insert (movie_choice_type, movie_id) on bookings to authenticated;

alter table groups add column movie_id uuid references movies(id);

-- ---- confirm_group(): movie hard-check + groups.movie_id ----
-- (0072_booking_plus_one.sql is the prior version being replaced)
create or replace function confirm_group(
  p_slot_id uuid,
  p_venue_id uuid,
  p_booking_ids uuid[],
  p_movie_id uuid default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_group_id uuid;
  v_booking_count int;
  v_seat_count int;
  v_min_size int;
  v_max_size int;
  v_activity_name text;
begin
  if not (select exists(select 1 from admin_users where id = auth.uid())) then
    raise exception 'Only admins can confirm groups';
  end if;

  if p_booking_ids is null or array_length(p_booking_ids, 1) is null then
    raise exception 'confirm_group requires at least one booking';
  end if;

  -- v_booking_count proves every id in p_booking_ids is a real
  -- pending_match+paid booking for this slot; v_seat_count is the actual
  -- headcount (a +1 booking counts as 2) checked against group size.
  select count(*), coalesce(sum(case when plus_one then 2 else 1 end), 0)
    into v_booking_count, v_seat_count
  from bookings
  where id = any(p_booking_ids)
    and slot_id = p_slot_id
    and status = 'pending_match'
    and payment_status = 'paid';

  if v_booking_count <> array_length(p_booking_ids, 1) then
    raise exception 'One or more bookings are not pending_match and paid for this slot';
  end if;

  select a.min_group_size, a.max_group_size, a.name
    into v_min_size, v_max_size, v_activity_name
  from slots s join activity_types a on a.id = s.activity_type_id
  where s.id = p_slot_id;

  if v_seat_count < v_min_size or v_seat_count > v_max_size then
    raise exception 'Group size % is outside the allowed range % - %', v_seat_count, v_min_size, v_max_size;
  end if;

  if p_venue_id is null then
    raise exception 'A venue is required to confirm a group';
  end if;

  if v_activity_name = 'Movies' and p_movie_id is null then
    raise exception 'A movie is required to confirm a Movies group';
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

  if exists (
    select 1
    from bookings b1
    join bookings b2 on b2.id = any(p_booking_ids) and b2.id <> b1.id
    where b1.id = any(p_booking_ids)
      and b1.movie_id is not null
      and b2.movie_id is not null
      and b1.movie_id <> b2.movie_id
  ) then
    raise exception 'This group has members who chose different movies';
  end if;

  insert into groups (slot_id, venue_id, movie_id, status, formed_by)
  values (p_slot_id, p_venue_id, p_movie_id, 'confirmed', auth.uid())
  returning id into v_group_id;

  insert into group_members (group_id, booking_id)
  select v_group_id, b.id from unnest(p_booking_ids) as b(id);

  update bookings set status = 'matched' where id = any(p_booking_ids);

  return v_group_id;
end;
$$;

-- ---- admin_add_group_member(): same movie hard-check recheck ----
-- (0072_booking_plus_one.sql is the prior version being replaced)
create or replace function admin_add_group_member(p_group_id uuid, p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
