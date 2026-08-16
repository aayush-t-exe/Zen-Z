-- ============================================
-- 0029_cancel_unpaid_booking.sql
-- Students had no way to back out of a booking they never paid for —
-- bookings has no self-service UPDATE policy at all (only "admin manage
-- all bookings"), by design, since a blanket self-update would also let a
-- student rewrite payment_status/status directly. A security definer RPC
-- (same pattern as confirm_group(), student_signup_dates()) that only
-- ever flips status to 'cancelled', and only when the caller owns the
-- booking and it's still unpaid/pending_match, avoids opening that up.
-- ============================================

create or replace function cancel_unpaid_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update bookings
  set status = 'cancelled'
  where id = p_booking_id
    and user_id = auth.uid()
    and payment_status = 'unpaid'
    and status = 'pending_match';

  if not found then
    raise exception 'Booking not found, not yours, or no longer cancellable';
  end if;
end;
$$;

grant execute on function cancel_unpaid_booking(uuid) to authenticated;
