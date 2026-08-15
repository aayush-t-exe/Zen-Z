-- ============================================
-- 0021_reports_moderation.sql
-- Milestone 17: Reports & Moderation.
--
-- docs/PRODUCT_SPEC.md §2.6 raised, as an explicit founder-judgment
-- [ASSUMPTION], whether a report should pause the reported student's
-- matching on the *first* report rather than after a pattern. Founder
-- decision (2026-08-14): no automatic pause — a single report does not
-- block the reported student from being matched. The founder reviews
-- open reports in the admin queue and watches the reported student
-- before taking any manual action, rather than the system pausing them
-- outright the way the no-show policy auto-blocks bookings.
--
-- §3.6 separately lists "existing reports/blocklist" as a hard filter
-- that must run before the compatibility score is ever computed — same
-- tier as the group_preference hard filter already enforced in
-- MatchingBoard.tsx. That part of a report's effect *is* implemented as
-- a hard, permanent gate inside confirm_group() (the single place group
-- membership is actually committed, mirroring 0017's payment_status
-- gate in the same existence-check query): a reporter and the student
-- they reported can never be placed in the same confirmed group again,
-- regardless of how the report is later resolved. This protects the
-- specific reporter and is unaffected by the no-auto-pause decision
-- above, which is only about the reported student's matching more
-- broadly.
-- ============================================

create index if not exists reports_reported_user_status_idx on reports (reported_user_id, status);
create index if not exists reports_reporter_reported_idx on reports (reporter_id, reported_user_id);

-- Students can already insert their own reports (0001's "users create
-- reports"). They also need to read back reports they filed, so the
-- mobile app can show "you've already reported this person" instead of
-- offering to file a duplicate.
create policy "self read own reports" on reports
  for select using (auth.uid() = reporter_id);

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

  insert into groups (slot_id, venue_id, status, formed_by)
  values (p_slot_id, p_venue_id, 'confirmed', auth.uid())
  returning id into v_group_id;

  insert into group_members (group_id, booking_id)
  select v_group_id, b.id from unnest(p_booking_ids) as b(id);

  update bookings set status = 'matched' where id = any(p_booking_ids);

  return v_group_id;
end;
$$;
