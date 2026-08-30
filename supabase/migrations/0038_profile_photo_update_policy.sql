-- ============================================
-- 0038_profile_photo_update_policy.sql
-- profile-creation.tsx uploads with `upsert: true` so a repeat upload
-- overwrites the previous photo instead of silently keeping it. Supabase
-- Storage implements that overwrite as an UPDATE on storage.objects, but
-- 0001_init.sql only ever granted INSERT + SELECT on that bucket — so any
-- re-upload to an existing profile.jpg has been failing RLS the whole time.
-- ============================================
create policy "self update own photo" on storage.objects
  for update using (
    bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
