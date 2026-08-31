-- ============================================
-- 0074_admin_cancel_booking_reclaims_referral_credit.sql
--
-- admin_cancel_booking (0070) deliberately never touches payment_status —
-- every refund is manual, real money only, issued from the PayU dashboard
-- by hand. A booking paid via a referral credit (0073) has no real money
-- behind it, so that rule is exactly right for it too: this migration
-- still never touches payment_status. What it does add is returning the
-- referral_credits row to 'available' when the booking it paid for gets
-- cancelled — without this, a founder-side cancellation would silently
-- and permanently strand the referrer's free adventure, which is a
-- process gap, not a refund. Found via referral_credits.consumed_booking_id
-- (the FK, i.e. the source of truth), not by parsing payment_id's
-- 'referral_credit:<id>' string, which exists purely as a human-readable
-- breadcrumb for admins glancing at raw booking rows.
-- ============================================

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

  update referral_credits
  set status = 'available', consumed_booking_id = null, consumed_at = null
  where consumed_booking_id = p_booking_id;

  update bookings set status = 'cancelled' where id = p_booking_id;
end;
$$;

grant execute on function admin_cancel_booking(uuid) to authenticated;
