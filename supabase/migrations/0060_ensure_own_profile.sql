-- ============================================
-- 0060_ensure_own_profile.sql
-- profile-creation.tsx's final step does `.update(...).eq('id', uid)` on
-- profiles, assuming the row already exists (normally true — handle_new_user()
-- creates it at signup, 0001_init.sql). For a handful of dev accounts whose
-- profiles row is missing (auth.users row present, profiles row gone —
-- found live on 2026-08-27: 6 accounts in this exact state, none of them
-- via delete_own_account(), which soft-deletes and bans rather than
-- removing the row), that UPDATE silently matches zero rows and reports
-- success with no error — profiles has no RLS INSERT policy at all (only
-- self-read/self-update, 0001_init.sql), so there was no self-heal path.
-- The student then sails through onboarding into the personality quiz,
-- where personality_answers.user_id's FK to profiles finally fails loudly.
--
-- Rather than opening a general client-writable INSERT policy on profiles
-- (which would need its own column-grant story, mirroring 0051's UPDATE
-- restrictions), a narrow security-definer RPC mirrors exactly what the
-- signup trigger already does — same shape, same bypass-RLS mechanism,
-- just re-runnable on demand instead of only at auth.users insert time.
-- ============================================

create or replace function ensure_own_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, email, full_name)
  select v_uid, u.email, 'New user'
  from auth.users u
  where u.id = v_uid
  on conflict (id) do nothing;
end;
$$;

grant execute on function ensure_own_profile() to authenticated;
