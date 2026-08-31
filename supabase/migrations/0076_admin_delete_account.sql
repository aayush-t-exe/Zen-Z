-- ============================================
-- 0076_admin_delete_account.sql
--
-- Founder-facing account deletion. Until now delete_own_account() (0045)
-- was self-service only — no way for the founder to remove an account
-- from the admin dashboard (a bad actor, a fake signup, a support
-- request). Rather than duplicate 0045's careful sequence (active-booking
-- guard, storage cleanup, PII scrub, auth ban) into a second copy that
-- can drift out of sync, the shared body moves into
-- internal_delete_account(), parameterized on the target user instead of
-- hardcoded to auth.uid(). Both delete_own_account() and the new
-- admin_delete_account() become thin wrappers that only differ in who
-- they're allowed to target and how they establish that.
--
-- internal_delete_account() is never granted to `authenticated` — it's
-- only reachable through the two gated wrappers, both security definer.
-- ============================================

create or replace function internal_delete_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from profiles where id = p_user_id and deleted_at is not null) then
    raise exception 'Account already deleted';
  end if;

  if exists (
    select 1 from bookings
    where user_id = p_user_id
      and payment_status = 'paid'
      and status in ('pending_match', 'matched')
  ) then
    raise exception 'ACTIVE_BOOKING';
  end if;

  -- A leftover unpaid pending_match booking has no payment to protect and
  -- no group to disrupt — cancel it so the admin matching board doesn't
  -- try to seat a deleted student.
  update bookings
  set status = 'cancelled'
  where user_id = p_user_id
    and status = 'pending_match'
    and payment_status = 'unpaid';

  delete from storage.objects
  where bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = p_user_id::text;

  update profiles
  set full_name = 'Deleted user',
      email = 'deleted-' || p_user_id || '@deleted.zen-z.internal',
      phone = null,
      photo_url = null,
      gender = null,
      year_of_study = null,
      date_of_birth = null,
      push_token = null,
      deleted_at = now(),
      updated_at = now()
  where id = p_user_id;

  -- Blocks sign-in (checked by GoTrue on every token issue/refresh)
  -- without touching auth.users' own delete cascade.
  update auth.users
  set banned_until = now() + interval '100 years'
  where id = p_user_id;
end;
$$;

create or replace function delete_own_account()
returns void
language plpgsql
security definer
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform internal_delete_account(auth.uid());
end;
$$;

-- Same guarantees as delete_own_account() (refuses on an active paid
-- booking, refuses if already deleted) — the only difference is who it's
-- allowed to target and the admin_users gate instead of "only yourself."
create or replace function admin_delete_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admin_users where id = auth.uid()) then
    raise exception 'Only admins can delete an account';
  end if;

  perform internal_delete_account(p_user_id);
end;
$$;

grant execute on function admin_delete_account(uuid) to authenticated;
