-- ============================================
-- 0073_referral_redemption_and_credits.sql
--
-- Builds the referral program (docs/PRODUCT_SPEC.md §1.13, never built
-- until now). referrals has existed since 0001_init.sql and was RLS-locked
-- in 0016 with an explicit note that whoever builds the real redemption
-- flow should design it deliberately — this is that design.
--
-- Founder decisions baked in here:
--   - Reward trigger: fires when the referred friend's FIRST booking's
--     payment_status flips to 'paid' (not at signup, not at event
--     completion).
--   - Referral cap: unlimited invites off one permanent code per owner —
--     the old referrals(code, owner_id, used_by, used_at) shape only
--     supported one redemption ever, so redemptions move to their own
--     table.
--   - Reward redemption: auto-applied. The referrer's next booking skips
--     PayU entirely if they have an available credit — no manual step.
--
-- used_by/used_at are dropped outright rather than kept dead: they're the
-- exact unrestricted-column gap docs/TESTING_CHECKLIST.md flagged as moot
-- only because nothing used them yet. Something uses this table now.
-- ============================================

alter table referrals drop column used_by;
alter table referrals drop column used_at;
alter table referrals add constraint referrals_owner_id_unique unique (owner_id);

-- No client insert policy left on referrals — codes are only minted by
-- get_or_create_referral_code() below (security definer, bypasses RLS),
-- so a student can't hand-pick an arbitrary/offensive code or collide
-- with someone else's by racing a raw insert.
drop policy "self create own referral" on referrals;

alter table profiles add column referred_by_code text references referrals(code);

-- Re-grant the full client-writable column list (0051's shape) with
-- referred_by_code added.
revoke update on profiles from authenticated;
grant update (full_name, date_of_birth, year_of_study, gender, phone, photo_url,
              push_token, referred_by_code)
  on profiles to authenticated;

-- Enforced here rather than a CHECK constraint because self-referral needs
-- a subquery (a plain CHECK can't reference another table), and
-- immutability needs old/new comparison.
create or replace function enforce_referred_by_code_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.referred_by_code is not null then
    new.referred_by_code := upper(trim(new.referred_by_code));
  end if;

  if old.referred_by_code is not null and new.referred_by_code is distinct from old.referred_by_code then
    raise exception 'Referral code cannot be changed once set';
  end if;

  if new.referred_by_code is not null
     and exists (select 1 from referrals where code = new.referred_by_code and owner_id = new.id) then
    raise exception 'You cannot use your own referral code';
  end if;

  return new;
end;
$$;

create trigger trg_referred_by_code_immutable
  before update of referred_by_code on profiles
  for each row execute function enforce_referred_by_code_immutable();

-- One row per successful "friend took their first step in" — the unique
-- constraint on referred_user_id is what makes grant_referral_reward()
-- below safe to call more than once for the same person (a webhook retry,
-- or two of their bookings racing to 'paid').
create table referral_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references referrals(code),
  referred_user_id uuid not null unique references profiles(id),
  redeemed_at timestamptz not null default now()
);

alter table referral_redemptions enable row level security;

create policy "self read own redemption" on referral_redemptions
  for select using (
    auth.uid() = referred_user_id
    or auth.uid() = (select owner_id from referrals where code = referral_redemptions.code)
  );

create policy "admin manage redemptions" on referral_redemptions
  for all using (auth.uid() in (select id from admin_users));

-- One "free adventure" per redemption. status flips to 'consumed' the
-- moment redeem_referral_credit() spends it on a specific booking.
create table referral_credits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id),
  redemption_id uuid not null unique references referral_redemptions(id),
  status text not null default 'available' check (status in ('available', 'consumed')),
  consumed_booking_id uuid references bookings(id),
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

alter table referral_credits enable row level security;

create policy "self read own credits" on referral_credits
  for select using (auth.uid() = owner_id);

create policy "admin manage credits" on referral_credits
  for all using (auth.uid() in (select id from admin_users));

-- Analytics-honesty flag. A referral-credit-paid booking has
-- payment_status = 'paid' with zero real money behind it — without this,
-- apps/admin/app/analytics's revenue/profit numbers would silently count
-- it as real revenue. Never client-writable; only redeem_referral_credit()
-- sets it, via security definer.
alter table bookings add column paid_via_referral_credit boolean not null default false;

create or replace function get_or_create_referral_code() returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_first text;
begin
  select code into v_code from referrals where owner_id = auth.uid();
  if v_code is not null then
    return v_code;
  end if;

  select upper(regexp_replace(split_part(coalesce(full_name, 'FRIEND'), ' ', 1), '[^A-Za-z]', '', 'g'))
    into v_first
    from profiles where id = auth.uid();

  loop
    v_code := left(coalesce(nullif(v_first, ''), 'FRIEND'), 6) || lpad(floor(random() * 10000)::text, 4, '0');
    begin
      insert into referrals (code, owner_id) values (v_code, auth.uid());
      return v_code;
    exception when unique_violation then
      -- code collision — loop and try another random suffix
    end;
  end loop;
end;
$$;

grant execute on function get_or_create_referral_code() to authenticated;

alter table notifications_outbox
  drop constraint notifications_outbox_type_check;
alter table notifications_outbox
  add constraint notifications_outbox_type_check
  check (type in (
    'booking_confirmed', 'group_matched', 'venue_reveal',
    'event_reminder_2h', 'post_event_feedback', 'no_show', 'new_message',
    'group_member_left', 'group_member_joined', 'referral_reward_earned'
  ));

-- Fires once, on whichever of the referred user's bookings first reaches
-- 'paid'. Relies solely on referral_redemptions' unique constraint (via
-- on conflict do nothing) rather than a pre-check count — a count check
-- would be both redundant and unsafe under concurrent payment_status
-- updates (two bookings racing to 'paid' could both see the same count
-- under READ COMMITTED). A payu-webhook retry is naturally harmless here
-- too: it lands with old.payment_status already 'paid', so the trigger's
-- WHEN clause below is false and this never re-runs for that row.
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
  select referred_by_code into v_code from profiles where id = new.user_id;
  if v_code is null then
    return new;
  end if;

  insert into referral_redemptions (code, referred_user_id)
  values (v_code, new.user_id)
  on conflict (referred_user_id) do nothing
  returning id into v_redemption_id;

  if v_redemption_id is null then
    return new; -- this user's reward was already granted on an earlier booking
  end if;

  select owner_id into v_owner_id from referrals where code = v_code;

  insert into referral_credits (owner_id, redemption_id) values (v_owner_id, v_redemption_id);

  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  values (v_owner_id, 'referral_reward_earned', v_redemption_id,
          'Your invitation just paid off.',
          'A friend you invited took their first step in — your next adventure is free.',
          jsonb_build_object('redemptionId', v_redemption_id))
  on conflict (type, user_id, reference_id) do nothing;

  return new;
end;
$$;

create trigger on_referral_reward
  after update of payment_status on bookings
  for each row
  when (new.payment_status = 'paid' and old.payment_status is distinct from 'paid')
  execute function grant_referral_reward();

-- Locks the booking row first (`for update`) so nothing can interleave
-- between checking its state and spending a credit against it, then locks
-- a single available credit with `skip locked` so two concurrent calls
-- can't claim the same one.
create or replace function redeem_referral_credit(p_booking_id uuid) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_pay_status text;
  v_credit_id uuid;
begin
  select status, payment_status into v_status, v_pay_status
  from bookings
  where id = p_booking_id and user_id = auth.uid()
  for update;

  if not found or v_pay_status <> 'unpaid' or v_status <> 'pending_match' then
    return false;
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
  returning id into v_credit_id;

  if v_credit_id is null then
    return false;
  end if;

  update bookings
  set payment_status = 'paid',
      payment_id = 'referral_credit:' || v_credit_id,
      paid_via_referral_credit = true
  where id = p_booking_id;

  return true;
end;
$$;

grant execute on function redeem_referral_credit(uuid) to authenticated;
