-- ============================================
-- 0077_delete_account_drop_broken_storage_delete.sql
--
-- Found while building admin_delete_account (0076) and testing it live:
-- `delete from storage.objects` inside a plpgsql function now raises
-- "Direct deletion from storage tables is not allowed. Use the Storage
-- API instead" (storage.protect_delete() — a platform-level trigger, not
-- anything in this project's own migrations). Since that statement was
-- unconditional and unguarded, this means delete_own_account() (0045) has
-- been silently failing outright for every student who ever uploaded a
-- photo — i.e. nearly everyone, since photo upload is required during
-- profile creation. Pre-existing bug, not something this migration
-- introduces; caught here because 0076 exercises the exact same code path
-- from a fresh angle.
--
-- Fix: internal_delete_account() drops the storage DELETE entirely and
-- goes back to being pure DB work (guards, booking cancel, profile scrub,
-- auth ban). The actual photo removal moves to the new delete-account
-- Edge Function (supabase/functions/delete-account), which calls the
-- Storage API the way the platform now requires — not raw SQL — as a
-- best-effort follow-up *after* this RPC has already succeeded, so a
-- storage-side hiccup can never block the security-critical part (PII
-- scrub + auth ban) from completing.
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

  update bookings
  set status = 'cancelled'
  where user_id = p_user_id
    and status = 'pending_match'
    and payment_status = 'unpaid';

  -- Photo removal happens in the delete-account Edge Function instead —
  -- see comment above. photo_url is still cleared below regardless, so
  -- the profile is correct even if the follow-up storage cleanup lags or
  -- fails.
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

  update auth.users
  set banned_until = now() + interval '100 years'
  where id = p_user_id;
end;
$$;
