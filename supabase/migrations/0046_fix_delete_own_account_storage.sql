-- ============================================
-- 0046_fix_delete_own_account_storage.sql
-- 0045's delete_own_account() deleted the student's photo with a raw
-- `delete from storage.objects`, which storage.protect_delete() (a
-- Supabase-managed trigger) rejects outright: "Direct deletion from
-- storage tables is not allowed. Use the Storage API instead." The
-- trigger's own escape hatch is a transaction-local setting, so flip it
-- right before the delete — set_config's third argument (true) scopes it
-- to the current transaction, so it reverts on its own once the function
-- returns.
-- ============================================

create or replace function delete_own_account()
returns void
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from profiles where id = v_uid and deleted_at is not null) then
    raise exception 'Account already deleted';
  end if;

  if exists (
    select 1 from bookings
    where user_id = v_uid
      and payment_status = 'paid'
      and status in ('pending_match', 'matched')
  ) then
    raise exception 'ACTIVE_BOOKING';
  end if;

  update bookings
  set status = 'cancelled'
  where user_id = v_uid
    and status = 'pending_match'
    and payment_status = 'unpaid';

  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects
  where bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = v_uid::text;

  update profiles
  set full_name = 'Deleted user',
      email = 'deleted-' || v_uid || '@deleted.zen-z.internal',
      phone = null,
      photo_url = null,
      gender = null,
      year_of_study = null,
      date_of_birth = null,
      push_token = null,
      deleted_at = now(),
      updated_at = now()
  where id = v_uid;

  update auth.users
  set banned_until = now() + interval '100 years'
  where id = v_uid;
end;
$$;

grant execute on function delete_own_account() to authenticated;
