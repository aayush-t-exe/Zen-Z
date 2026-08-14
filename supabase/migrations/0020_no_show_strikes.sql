-- ============================================
-- 0020_no_show_strikes.sql
-- No-show strike policy: 3 no-shows (no_shows rows, from 0001/0019) block a
-- student from creating new bookings for 7 days. The block clears itself —
-- there is no founder override action, matching the founder's choice of a
-- pure auto-expiring block over a manual-unblock flow.
--
-- Design: no_show_strikes counts un-punished no-shows. The moment it hits 3,
-- the block is applied and the counter is reset to 0 in the same statement —
-- not left at 3 to be reset later. This is equivalent to "reset once the
-- block ends" for every reachable state: a student can't rack up further
-- no-shows *during* a block, since being blocked means they have no bookings
-- to miss. So there's nothing to reset once booking_blocked_until passes;
-- the count is already sitting at 0, waiting for the next set of 3.
-- ============================================

alter table profiles add column no_show_strikes integer not null default 0;
alter table profiles add column booking_blocked_until timestamptz;

-- Row-level policy still lets a student update their own profile row (name,
-- gender, push_token, etc. — 0001's "self update profile"), so these two
-- columns need an explicit column-level lock: only a service-role client
-- (this trigger, or an admin action) may ever write them.
revoke update (no_show_strikes, booking_blocked_until) on profiles from authenticated;

create or replace function apply_no_show_strike()
returns trigger
language plpgsql
security definer
as $$
declare
  v_strikes int;
begin
  update profiles
  set no_show_strikes = no_show_strikes + 1
  where id = new.user_id
  returning no_show_strikes into v_strikes;

  if v_strikes >= 3 then
    update profiles
    set booking_blocked_until = now() + interval '7 days',
        no_show_strikes = 0
    where id = new.user_id;
  end if;

  return new;
end;
$$;

create trigger on_no_show_apply_strike
  after insert on no_shows
  for each row execute function apply_no_show_strike();

-- Enforce the block at the source of booking creation. Bookings are
-- inserted directly from the mobile client via supabase-js (there's no
-- create-booking Edge Function to gate instead — see create-payment-order,
-- which only ever updates an existing booking), so RLS is the only
-- server-side checkpoint available.
drop policy "own bookings insert" on bookings;
create policy "own bookings insert" on bookings
  for insert with check (
    auth.uid() = user_id
    and not exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.booking_blocked_until is not null
        and p.booking_blocked_until > now()
    )
  );
