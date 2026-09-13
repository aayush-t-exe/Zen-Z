-- ============================================
-- 0085_delete_account_scrub_auth_email.sql
--
-- Bug found live: a deleted student could never sign up again with the
-- same email. internal_delete_account() (0045/0076/0077) scrubs
-- profiles.email but never touches auth.users.email — it only sets
-- banned_until. GoTrue enforces a unique email across all of auth.users
-- regardless of ban status, so the original address stayed permanently
-- claimed by the banned, unreachable identity. Confirmed live against
-- campus-social-dev: both existing soft-deleted accounts still hold their
-- real email in auth.users (and in auth.identities' identity_data), one
-- of them on a row banned until 2126.
--
-- Fix: scrub auth.users.email (and the mirrored auth.identities
-- identity_data->>'email') to the same deleted.zen-z.internal placeholder
-- already used for profiles.email, freeing the real address for a fresh
-- signup. The identity's provider_id is the user's own uuid, not their
-- email, so this doesn't touch anything unique-constrained there.
-- ============================================

create or replace function internal_delete_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scrubbed_email text := 'deleted-' || p_user_id || '@deleted.zen-z.internal';
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
  -- see 0077. photo_url is still cleared below regardless, so the profile
  -- is correct even if the follow-up storage cleanup lags or fails.
  update profiles
  set full_name = 'Deleted user',
      email = v_scrubbed_email,
      phone = null,
      photo_url = null,
      gender = null,
      year_of_study = null,
      date_of_birth = null,
      push_token = null,
      deleted_at = now(),
      updated_at = now()
  where id = p_user_id;

  update auth.identities
  set identity_data = identity_data || jsonb_build_object('email', v_scrubbed_email)
  where user_id = p_user_id
    and provider = 'email';

  update auth.users
  set email = v_scrubbed_email,
      banned_until = now() + interval '100 years'
  where id = p_user_id;
end;
$$;

-- Backfill: free the real email address on every account already stuck in
-- this state (deleted, but still occupying its original email in
-- auth.users/auth.identities).
update auth.identities i
set identity_data = i.identity_data || jsonb_build_object(
  'email', 'deleted-' || i.user_id || '@deleted.zen-z.internal'
)
from profiles p
where p.id = i.user_id
  and p.deleted_at is not null
  and i.provider = 'email';

update auth.users u
set email = 'deleted-' || u.id || '@deleted.zen-z.internal'
from profiles p
where p.id = u.id
  and p.deleted_at is not null
  and u.email <> 'deleted-' || u.id || '@deleted.zen-z.internal';
