-- ============================================
-- 0064_students_view_onboarding_complete.sql
--
-- admin_student_profiles (0004_storage_helpers.sql) surfaced every row in
-- `profiles`, including accounts that started signup but abandoned it
-- mid-onboarding (no photo, no gender/year set, never took the
-- personality quiz) — founder decision: those aren't students, they never
-- finished becoming one, so the Students directory shouldn't list them.
--
-- "Finished onboarding" mirrors getPostAuthRoute's own definition of
-- reaching (home) (apps/mobile/src/lib/authRouting.ts) exactly: a real
-- full_name (not the 'New user' sentinel handle_new_user() seeds),
-- gender, year_of_study, and at least one personality_scores row.
-- ============================================

create or replace view admin_student_profiles as
select
  p.id,
  p.email,
  p.phone,
  p.full_name,
  p.year_of_study,
  p.gender,
  case when p.photo_url is not null then 'profile-photos\' || p.id::text || '/profile.jpg' else null end as photo_path,
  p.created_at
from profiles p
where auth.uid() in (select id from admin_users)
  and p.full_name is not null
  and p.full_name <> 'New user'
  and p.gender is not null
  and p.year_of_study is not null
  and exists (select 1 from personality_scores ps where ps.user_id = p.id);

alter view admin_student_profiles set (security_invoker = true);
