-- ============================================
-- 0070_admin_cancel_booking.sql
--
-- No admin-facing cancel-booking action exists anywhere in the codebase
-- yet. cancel_unpaid_booking (0029) is self-service and only works on an
-- unpaid, still-pending_match booking; there is no admin equivalent, and
-- no way at all to remove someone from an already-confirmed group before
-- the event happens (enforce_group_member_leave_only, 0048/0067/0068,
-- deliberately blocks self-service leaving until AFTER the event).
--
-- admin_cancel_booking() is the founder's single cancel action, working
-- identically whether the booking is still pending_match (not yet
-- grouped) or already placed into a confirmed group. Founder decisions
-- (2026-08-30) baked into this design:
--   - The group_members row is deleted outright, not the left_at-archive
--     pattern the self-service leave flow uses — an admin-cancelled
--     booking is void, not a personal archive choice, so the student
--     loses group access immediately and the group's real membership
--     count actually shrinks (unlike self-service leave, which is purely
--     a personal visibility flag).
--   - The other, still-active members of that group get a new
--     'group_member_left' notification automatically (widening
--     notifications_outbox_type_check, same pattern 0066 used for
--     new_message) rather than relying on the founder to message them
--     by hand.
--   - payment_status is deliberately left untouched. Every refund path
--     in this codebase (docs/KNOWN_ISSUES.md, apps/marketing's refund
--     policy, payu-webhook's cancel/payment-race comment) is manual —
--     the founder issues refunds from the PayU dashboard by hand, not
--     through the app. This RPC only records that the booking is void;
--     it never touches money.
--   - No reason/note field — a simple confirm-and-cancel action, same
--     weight as confirm_group's own flow.
--
-- [ASSUMPTION] The 'group_member_left' notification copy below has no
-- existing entry in docs/PRODUCT_SPEC.md §1.10's microcopy table (same
-- gap 0066 flagged for new_message) — provisional pending founder
-- sign-off, not verbatim spec copy like booking_confirmed/group_matched
-- are.
--
-- security definer because `authenticated` has no UPDATE grant on any
-- bookings column except status (0059) and none at all on payment_status,
-- and because deleting a group_members row and inserting notifications
-- for *other* users needs to cross those users' own RLS.
-- ============================================

alter table notifications_outbox
  drop constraint notifications_outbox_type_check;
alter table notifications_outbox
  add constraint notifications_outbox_type_check
  check (type in (
    'booking_confirmed', 'group_matched', 'venue_reveal',
    'event_reminder_2h', 'post_event_feedback', 'no_show', 'new_message',
    'group_member_left'
  ));

create or replace function admin_cancel_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
    select 'Your group just changed.',
           a.name || ', ' || to_char(s.slot_datetime at time zone 'Asia/Kolkata', 'Dy HH12:MI AM')
             || ' — one seat opened up, but your plans are still on.'
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

  update bookings set status = 'cancelled' where id = p_booking_id;
end;
$$;

grant execute on function admin_cancel_booking(uuid) to authenticated;
