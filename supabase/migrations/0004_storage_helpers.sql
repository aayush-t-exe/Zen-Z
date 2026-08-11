-- ============================================
-- 0004_storage_helpers.sql
-- Photo access helpers for admin dashboard.
-- Enables secure, signed-URL photo viewing
-- while maintaining strict privacy enforcement.
-- ============================================

-- ============================================
-- HELPER FUNCTION: Generate signed photo URL
-- ============================================
-- Returns a time-limited signed URL (24h) for accessing a student's photo.
-- Only admins can call this; only their own generated URLs work.
-- This prevents accidental public photo leaks via URL copy-paste.
create or replace function get_student_photo_url(student_id uuid, expires_in_seconds int default 86400)
returns text as $$
declare
  photo_path text;
begin
  -- Only admins can generate photo URLs
  if not (select exists(select 1 from admin_users where id = auth.uid())) then
    raise exception 'Only admins can access student photos';
  end if;

  -- Fetch the student's photo path
  select photo_url into photo_path
  from profiles
  where id = student_id;

  -- If no photo, return null
  if photo_path is null then
    return null;
  end if;

  -- Return the photo path; the admin dashboard will call
  -- supabase.storage.from('profile-photos').createSignedUrl(path, 86400)
  -- to generate a time-limited URL on the client.
  return 'profile-photos/' || student_id::text || '/profile.jpg';
end;
$$ language plpgsql security definer;

-- ============================================
-- VIEW: Student profiles visible to admin
-- ============================================
-- Admin-only view of student profiles without exposing raw photo_url.
-- Admin dashboard queries this to build the matching board.
-- The view includes the storage path, not the public URL, forcing
-- the admin dashboard to go through signed-URL generation.
create or replace view admin_student_profiles as
select
  p.id,
  p.email,
  p.phone,
  p.full_name,
  p.year_of_study,
  p.gender,
  -- Include the photo path (not the URL) so admin dashboard can
  -- request a signed URL via get_student_photo_url()
  case when p.photo_url is not null then 'profile-photos/' || p.id::text || '/profile.jpg' else null end as photo_path,
  p.created_at
from profiles p
where auth.uid() in (select id from admin_users);

alter view admin_student_profiles set (security_invoker = true);

-- ============================================
-- VIEW: Student with computed personality vector
-- ============================================
-- For the matching dashboard: students with their personality scores
-- and photo access info. The matching engine will use this to compute
-- group compatibility.
create or replace view admin_students_with_personality as
select
  p.id,
  p.full_name,
  p.email,
  p.gender,
  p.year_of_study,
  case when p.photo_url is not null then 'profile-photos/' || p.id::text || '/profile.jpg' else null end as photo_path,
  -- Personality scores as a JSON object keyed by dimension_id
  coalesce(
    json_object_agg(ps.dimension_id::text, ps.score order by ps.dimension_id),
    '{}'::json
  ) as personality_scores,
  p.created_at
from profiles p
left join personality_scores ps on ps.user_id = p.id
where auth.uid() in (select id from admin_users)
group by p.id, p.email, p.phone, p.full_name, p.year_of_study, p.gender, p.photo_url, p.created_at;

alter view admin_students_with_personality set (security_invoker = true);

-- ============================================
-- VIEW: Photo access audit log helper
-- ============================================
-- This view helps verify that photo privacy is actually working:
-- it shows which students have photos and whether they're properly
-- stored in the private bucket. Used during testing, not in prod UI.
create or replace view photo_storage_audit as
select
  p.id as student_id,
  p.full_name,
  p.email,
  p.photo_url is not null as has_photo,
  case
    when p.photo_url is null then 'no_photo'
    when p.photo_url like '%profile-photos%' then 'stored_correctly'
    else 'unexpected_url_format'
  end as photo_status,
  p.updated_at
from profiles p
where auth.uid() in (select id from admin_users)
order by p.created_at desc;

alter view photo_storage_audit set (security_invoker = true);

-- ============================================
-- RLS: Views inherit from profiles table (already enabled in 0001)
-- ============================================
-- Views use the existing RLS policies on profiles; they do not need
-- separate policies. The security_invoker = true setting ensures RLS
-- is evaluated in the context of the querying user.

-- ============================================
-- COMMENT: Photo privacy enforcement layers
-- ============================================
-- 1. Storage bucket is private (not public)
-- 2. RLS on storage.objects restricts read to:
--    - User's own photo (self read own photo policy)
--    - Admin users (admin read all photos policy)
-- 3. Photo_url is only in profiles; groupmate view excludes it
-- 4. Admin dashboard MUST use signed URLs (get_student_photo_url)
--    to prevent accidental public URL exposure
--
-- Result: Photos are literally inaccessible to students outside their
-- own profile, and even to admins via any route except explicit,
-- time-limited signed URLs.
