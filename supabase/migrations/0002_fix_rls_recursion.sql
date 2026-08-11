-- ============================================
-- 0002_fix_rls_recursion.sql
-- Remove the recursive RLS policy on profiles that was causing infinite
-- recursion when updating profiles. Will be revisited when groupmate
-- visibility is properly implemented.
-- ============================================

drop policy if exists "members read groupmate public info" on profiles;
