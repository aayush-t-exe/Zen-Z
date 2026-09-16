-- ============================================
-- 0098_admin_mark_booking_paid.sql
--
-- 2026-09-16: a real student's payment_status stayed 'unpaid' after PayU
-- actually captured the money (webhook never landed or failed silently —
-- see payment_webhook_events, 0097). The only way to unblock them was a
-- hand-run SQL UPDATE. admin_mark_booking_paid() is the safe, audited
-- replacement: the founder confirms the transaction actually succeeded in
-- PayU's own dashboard first (this RPC has no way to check that itself —
-- see create-payment-order/logic.ts's comments on why PayU's Payment
-- Links GET response can't be trusted to distinguish paid from merely
-- inactive/expired), then clicks one confirm action instead of needing
-- someone to run SQL by hand.
--
-- Deliberately narrow, mirroring admin_cancel_booking's (0070) own
-- guards:
--   - Only flips an 'unpaid' booking to 'paid' — refuses a no-op re-mark
--     of an already-paid booking, and refuses a cancelled booking (the
--     same cancel/payment-race boundary shouldMarkBookingPaid enforces in
--     the webhook — an admin should not be able to resurrect a cancelled
--     booking's payment status through this path either).
--   - payment_id is left exactly as-is. It already holds whatever
--     create-payment-order set (our own invoiceNumber, since the webhook
--     never got far enough to overwrite it with PayU's real mihpayid) —
--     good enough for the founder to cross-reference against the PayU
--     dashboard transaction they just confirmed by hand.
-- ============================================

create or replace function admin_mark_booking_paid(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_payment_status text;
begin
  if not (select exists(select 1 from admin_users where id = auth.uid())) then
    raise exception 'Only admins can mark a booking paid';
  end if;

  select status, payment_status into v_status, v_payment_status
  from bookings where id = p_booking_id;

  if v_status is null then
    raise exception 'Booking not found';
  end if;
  if v_status = 'cancelled' then
    raise exception 'This booking is cancelled — a cancelled booking cannot be marked paid here';
  end if;
  if v_payment_status = 'paid' then
    raise exception 'This booking is already marked paid';
  end if;

  update bookings set payment_status = 'paid' where id = p_booking_id;
end;
$$;

grant execute on function admin_mark_booking_paid(uuid) to authenticated;
