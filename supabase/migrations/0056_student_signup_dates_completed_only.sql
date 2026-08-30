-- ============================================
-- 0056_student_signup_dates_completed_only.sql
-- handle_new_user() (0001_init.sql) creates a profiles row the moment a
-- student hits "Continue" on the email screen — signInWithOtp() with
-- shouldCreateUser:true creates the auth.users row (and the profiles row
-- via the trigger) before the OTP is even sent, let alone verified. That
-- made student_signup_dates() (0027, fixed in 0028) count every started
-- signup as a "user," including ones who never verified the OTP or
-- abandoned onboarding before finishing profile creation — inflating the
-- admin analytics "Total users" stat and the signup trend chart.
--
-- Apply the same "is this profile actually complete" check the mobile app
-- already uses to decide routing (apps/mobile/src/lib/authRouting.ts,
-- getPostAuthRoute): full_name set and past the 'New user' seed sentinel,
-- gender set, year_of_study set. A student only counts once they've
-- actually finished the profile-creation screen, not merely entered an
-- email.
-- ============================================

create or replace function student_signup_dates()
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
stable
as $$
begin
  if not exists (select 1 from admin_users au where au.id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
    select p.id, p.created_at
    from profiles p
    where p.id not in (select au.id from admin_users au)
      and p.full_name is not null
      and p.full_name <> 'New user'
      and p.gender is not null
      and p.year_of_study is not null;
end;
$$;
