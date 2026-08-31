-- ============================================
-- 0075_referral_partial_credits.sql
--
-- 0073 made every referral credit a full waiver on ANY activity, no value
-- cap. Founder decision (2026-08-31), after seeing the real fee schedule
-- (Café/Dinner ₹21, Movies ₹126, Box Cricket/Football ₹221, most of that
-- ₹221 being a real pass-through venue/equipment cost, not margin): a
-- credit earned cheaply (a friend's ₹21 Café booking) must not be able to
-- fully cover an expensive booking — that's real cash out of pocket, not
-- foregone profit. Fix: cap every credit at a flat ₹21 (the lowest fee
-- tier). ₹21 is also, not coincidentally, exactly Box Cricket/Football's
-- profit_amount today — a ₹21 discount floors the founder's per-booking
-- profit at zero (breakeven) rather than pushing it negative, across the
-- entire current fee schedule (Café/Dinner: 21-21=0, Pool: 32.5-21=11.5,
-- Movies: 26-21=5, Pickleball: 29-21=8, Box Cricket/Football: 21-21=0).
-- A credit still fully covers Café/Dinner/Sports-tier bookings (fee=₹21);
-- on anything pricier, it's a ₹21 discount and the student pays the rest
-- through the normal PayU flow.
-- ============================================

alter table referral_credits add column value_rupees numeric not null default 21;

-- The amount of a booking's fee already covered by a referral credit —
-- read by create-payment-order to charge the discounted remainder, and by
-- admin analytics to keep revenue/profit honest. Never client-writable;
-- only redeem_referral_credit() below sets it.
alter table bookings add column referral_discount_amount numeric not null default 0;

-- Replaces the 0073 version. Previously: found one available credit,
-- always fully waived the booking. Now: computes the booking's real fee
-- (activity's convenience_fee, doubled for plus_one — same math
-- create-payment-order/logic.ts's computeOrderAmountRupees uses
-- client-side, duplicated here since this runs before that function is
-- ever called), discounts by least(credit's value, fee), and only marks
-- the booking paid outright when the discount fully covers it. Otherwise
-- the booking stays 'unpaid' with referral_discount_amount set, and the
-- student's next tap of "Pay" goes through create-payment-order for the
-- discounted remainder — payu-webhook doesn't care what the charged
-- amount was, it just marks whatever bookingId it's told paid.
--
-- Returns jsonb rather than a plain boolean now that "applied" and
-- "fully covered" are different outcomes the caller (payment.tsx) needs
-- to render differently (skip straight to the sealed screen vs. show a
-- discounted price and still collect payment).
-- Postgres refuses `create or replace` across a return-type change
-- (boolean -> jsonb), so the old signature has to go first.
drop function if exists redeem_referral_credit(uuid);

create function redeem_referral_credit(p_booking_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_pay_status text;
  v_plus_one boolean;
  v_fee numeric;
  v_credit_id uuid;
  v_credit_value numeric;
  v_discount numeric;
begin
  select b.status, b.payment_status, b.plus_one, a.convenience_fee
    into v_status, v_pay_status, v_plus_one, v_fee
  from bookings b
  join slots s on s.id = b.slot_id
  join activity_types a on a.id = s.activity_type_id
  where b.id = p_booking_id and b.user_id = auth.uid()
  for update of b;

  if not found or v_pay_status <> 'unpaid' or v_status <> 'pending_match' then
    return jsonb_build_object('applied', false, 'discount', 0, 'fullyCovered', false);
  end if;

  if v_fee is null then
    v_fee := 21;
  end if;
  if v_plus_one then
    v_fee := v_fee * 2;
  end if;

  update referral_credits
  set status = 'consumed', consumed_booking_id = p_booking_id, consumed_at = now()
  where id = (
    select id from referral_credits
    where owner_id = auth.uid() and status = 'available'
    order by created_at
    for update skip locked
    limit 1
  )
  returning id, value_rupees into v_credit_id, v_credit_value;

  if v_credit_id is null then
    return jsonb_build_object('applied', false, 'discount', 0, 'fullyCovered', false);
  end if;

  v_discount := least(v_credit_value, v_fee);

  if v_discount >= v_fee then
    update bookings
    set payment_status = 'paid',
        payment_id = 'referral_credit:' || v_credit_id,
        paid_via_referral_credit = true,
        referral_discount_amount = v_discount
    where id = p_booking_id;
  else
    update bookings
    set paid_via_referral_credit = true,
        referral_discount_amount = v_discount
    where id = p_booking_id;
  end if;

  return jsonb_build_object(
    'applied', true,
    'discount', v_discount,
    'fullyCovered', v_discount >= v_fee,
    'remainingDue', greatest(v_fee - v_discount, 0)
  );
end;
$$;

grant execute on function redeem_referral_credit(uuid) to authenticated;

-- cancel_unpaid_booking (0029) is self-service, so a booking can now reach
-- it in a state that didn't exist before this migration: unpaid, but with
-- a consumed referral credit already applied as a partial discount (the
-- student saw the discounted price, backed out before paying the rest).
-- Without this, that credit would be gone for good the moment they
-- cancel — the same process gap 0074 already closed for the admin cancel
-- path, needed here too since this is a second, independent way a booking
-- can end up cancelled.
create or replace function cancel_unpaid_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update referral_credits
  set status = 'available', consumed_booking_id = null, consumed_at = null
  where consumed_booking_id = p_booking_id
    and exists (
      select 1 from bookings
      where id = p_booking_id and user_id = auth.uid() and payment_status = 'unpaid'
    );

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
