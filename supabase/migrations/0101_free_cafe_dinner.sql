-- ============================================
-- 0101_free_cafe_dinner.sql
--
-- Founder decision (2026-09-28): Cafés and Dinners are free for students.
-- Revenue on these two comes from venue commission instead, so the goal is
-- turnout, not a ticket price.
--
-- PayU can't mint a ₹0 payment link, and matching/confirm_group only ever
-- consider payment_status = 'paid' bookings, so a free booking has to be
-- sealed server-side without PayU. It's done here at insert time, from the
-- server's own price, never from anything the client sends. Free bookings
-- are marked with payment_id = 'free' so every downstream path can tell
-- them apart from money actually collected.
--
-- Founder decisions for free bookings:
--   * A friend's free booking does NOT earn the referrer a credit
--     (otherwise throwaway accounts could farm ₹21 credits for Movies/Sports).
--   * Students can cancel their own free booking while it's still unmatched.
-- ============================================

update activity_types set convenience_fee = 0 where name in ('Cafés', 'Dinners');

create or replace function seal_free_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee numeric;
begin
  select case
           when new.movie_choice_type = 'choose_movie' and m.price is not null then m.price
           else a.convenience_fee
         end
    into v_fee
  from slots s
  join activity_types a on a.id = s.activity_type_id
  left join movies m on m.id = new.movie_id
  where s.id = new.slot_id;

  if v_fee = 0 then
    new.payment_status := 'paid';
    new.payment_id := 'free';
  end if;

  return new;
end;
$$;

revoke execute on function seal_free_booking() from public, anon, authenticated;

create trigger on_booking_seal_free
  before insert on bookings
  for each row execute function seal_free_booking();

-- Same as 0073's version, plus the early return for free bookings. The
-- notification body changes too: with Cafés/Dinners free, the only things
-- left to spend a ₹21 credit on (Movies, Sports) all cost more than ₹21,
-- so "your next adventure is free" is no longer true.
create or replace function grant_referral_reward() returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
          'Your invitation just paid off.',
          'A friend you invited just booked their first paid adventure. You get ₹21 off your next Movie or Sports game.',
          jsonb_build_object('redemptionId', v_redemption_id))
  on conflict (type, user_id, reference_id) do nothing;

  return new;
end;
$$;

revoke execute on function grant_referral_reward() from public, anon, authenticated;

-- Same as 0075's version, but a free booking can be cancelled too. A free
-- booking never consumes a credit (redeem_referral_credit only acts on
-- unpaid bookings), so the credit-restore step only ever matters for the
-- unpaid case.
create or replace function cancel_unpaid_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
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
    and status = 'pending_match'
    and (payment_status = 'unpaid' or payment_id = 'free');

  if not found then
    raise exception 'Booking not found, not yours, or no longer cancellable';
  end if;
end;
$$;

revoke execute on function cancel_unpaid_booking(uuid) from public, anon;
grant execute on function cancel_unpaid_booking(uuid) to authenticated;

-- Café/Dinner bookings still sitting unpaid from before the switch would
-- otherwise be stuck on a ₹0 payment screen PayU can't serve. Seal them the
-- same way, handing back any referral credit a +1 booking had partially
-- spent on its old ₹42 fee first.
update referral_credits rc
set status = 'available', consumed_booking_id = null, consumed_at = null
from bookings b
join slots s on s.id = b.slot_id
join activity_types a on a.id = s.activity_type_id
where rc.consumed_booking_id = b.id
  and a.name in ('Cafés', 'Dinners')
  and b.status = 'pending_match'
  and b.payment_status = 'unpaid';

update bookings b
set payment_status = 'paid',
    payment_id = 'free',
    paid_via_referral_credit = false,
    referral_discount_amount = 0
from slots s
join activity_types a on a.id = s.activity_type_id
where s.id = b.slot_id
  and a.name in ('Cafés', 'Dinners')
  and b.status = 'pending_match'
  and b.payment_status = 'unpaid';
