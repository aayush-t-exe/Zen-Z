-- ============================================
-- 0069_payu_payment_reference_lookup.sql
-- Part of the Razorpay -> PayU cutover.
--
-- apps/marketing/app/payment-redirect used to reconstruct the mobile
-- app's deep link purely from a `to` query param Razorpay's callback_url
-- echoed back per-request. PayU's Payment Links product only supports a
-- static, dashboard-configured return URL, so the redirect bridge can no
-- longer rely on anything being passed through beyond PayU's own txnid.
-- This RPC lets it look up which slot a payment attempt belongs to from
-- our own minted payment_id, so it can reconstruct
-- mobile://payment-callback?slotId=<looked-up-id> itself.
--
-- bookings is locked to owner+admin only since 0059 (column grants) and
-- carries no public read policy — a SECURITY DEFINER function (same
-- pattern as cancel_unpaid_booking, 0029) is the narrow crossing of that
-- boundary. It returns only a slot_id, never user_id/payment_status/the
-- booking id itself. slots is already `anyone read` (0007), so handing
-- back a slot_id isn't a new sensitivity boundary. Grantable to `anon`
-- because the redirect bridge runs unauthenticated (same precedent as
-- my_group_ids() in 0009).
-- ============================================

create or replace function slot_id_for_payment_reference(p_payment_id text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select slot_id from bookings where payment_id = p_payment_id limit 1;
$$;

grant execute on function slot_id_for_payment_reference(text) to anon, authenticated;
