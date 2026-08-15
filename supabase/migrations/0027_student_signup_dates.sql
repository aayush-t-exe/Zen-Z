-- ============================================
-- 0027_student_signup_dates.sql
-- Analytics needs student-only signup counts (excluding the founder's own
-- admin_users accounts), but admin_users' RLS policy (0007_close_rls_gaps.sql,
-- "self read own admin row") deliberately only lets an admin read their OWN
-- row — it's non-recursive on purpose, to avoid the same RLS-recursion bug
-- 0002 had to fix on profiles. That means a plain client-side
-- `.from('admin_users').select('id')` only ever returns the caller's own
-- id, silently under-excluding admins when there's more than one.
--
-- A security definer function sidesteps this the same way my_group_ids()
-- (0009) and confirm_group() do elsewhere in this schema: it runs with the
-- function owner's privileges, so its internal admin_users read isn't
-- subject to the caller's RLS row-visibility limit.
-- ============================================

create or replace function student_signup_dates()
returns table (id uuid, created_at timestamptz)
language plpgsql
security definer
stable
as $$
begin
  if not exists (select 1 from admin_users where id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
    select p.id, p.created_at
    from profiles p
    where p.id not in (select au.id from admin_users au);
end;
$$;

grant execute on function student_signup_dates() to authenticated;
