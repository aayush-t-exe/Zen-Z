-- ============================================
-- 0045_delete_own_account.sql
-- Self-serve account deletion (Apple/Play policy requires an in-app path,
-- not just a "contact us" request). A hard delete of auth.users would
-- cascade into profiles, which then hits ON DELETE RESTRICT on bookings,
-- groups.formed_by, messages, reports, no_shows and referrals for any
-- student with real history — the delete would just fail. Soft-delete
-- instead: scrub PII on the profiles row (keeps payment/no-show/report
-- history intact for financial audit and trust & safety) and ban the
-- auth identity so they can't sign back in as themselves.
--
-- Refuses to run if the student has a paid booking that hasn't resolved
-- yet (pending_match or matched) — there's no backfill/refund flow today
-- for pulling one member out of a forming/confirmed group, so deleting
-- out from under 3-4 other students who are counting on them is worse
-- than asking them to cancel or message us first.
-- ============================================

alter table profiles add column deleted_at timestamptz;

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

  -- A leftover unpaid pending_match booking has no payment to protect and
  -- no group to disrupt — cancel it so the admin matching board doesn't
  -- try to seat a deleted student.
  update bookings
  set status = 'cancelled'
  where user_id = v_uid
    and status = 'pending_match'
    and payment_status = 'unpaid';

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

  -- Blocks sign-in (checked by GoTrue on every token issue/refresh)
  -- without touching auth.users' own delete cascade.
  update auth.users
  set banned_until = now() + interval '100 years'
  where id = v_uid;
end;
$$;

grant execute on function delete_own_account() to authenticated;
