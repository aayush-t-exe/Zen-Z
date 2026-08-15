-- ============================================
-- 0028_fix_student_signup_dates_ambiguity.sql
-- 0027's student_signup_dates() declares `id` as an OUT parameter via
-- `returns table (id uuid, ...)`, which PL/pgSQL treats as an implicit
-- variable in scope for the whole function body — colliding with
-- admin_users.id inside `where id = auth.uid()` ("column reference \"id\"
-- is ambiguous"). Qualify it explicitly.
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
    where p.id not in (select au.id from admin_users au);
end;
$$;
