-- The "self update profile" RLS policy on profiles (0001_init.sql) only
-- restricts *which row* a student can update (auth.uid() = id) — RLS has
-- no concept of column-level restriction, so a direct PostgREST call with
-- a valid session could update any column on the row, including `email`
-- (which should mirror auth.users.email, not be independently editable)
-- and `id`/`created_at` (identity/audit fields). Column-level GRANTs are
-- the actual mechanism for that boundary.
--
-- Note: photo_url is safe to leave grantable — get_student_photo_url() and
-- the admin_* views (0004_storage_helpers.sql) never trust the column's
-- string value as a path; they only check it for null and always derive
-- the real storage path from the authenticated student_id itself.
revoke update on profiles from authenticated;

grant update (full_name, date_of_birth, year_of_study, gender, phone, photo_url, push_token)
  on profiles to authenticated;
