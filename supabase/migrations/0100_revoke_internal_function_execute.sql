-- ============================================
-- 0100_revoke_internal_function_execute.sql
--
-- Security fix found in the 2026-09-23 pre-launch audit.
--
-- internal_delete_account(p_user_id) (0076/0077/0085) is SECURITY DEFINER
-- with no caller check of its own: it trusts that only delete_own_account()
-- and admin_delete_account() ever call it. 0076's comment says it is "never
-- granted to authenticated", but Postgres grants EXECUTE on every new
-- function to PUBLIC by default, and Supabase's default privileges grant it
-- to anon and authenticated directly as well. Nothing ever revoked that, so
-- anyone holding the public anon key could call
-- POST /rest/v1/rpc/internal_delete_account with any user's uuid and wipe
-- and ban that account (including the founder's admin login, whose uuid is
-- visible to students as groups.formed_by).
--
-- The three cron-only functions below have the same stray grant. None is
-- exploitable the way internal_delete_account is (they're idempotent), but
-- ensure_next_slot takes arbitrary day/hour arguments, so an outsider could
-- create a real bookable slot at a time the founder never chose.
--
-- Every function here is owned by postgres, and every caller that should
-- reach them runs as postgres: the pg_cron jobs (cron.job.username =
-- postgres), and delete_own_account()/admin_delete_account(), which are
-- SECURITY DEFINER owned by postgres. Revoking from PUBLIC/anon/
-- authenticated therefore breaks nothing legitimate. service_role keeps
-- its grant.
-- ============================================

revoke execute on function internal_delete_account(uuid) from public, anon, authenticated;

revoke execute on function ensure_next_slot(text, int, int, int) from public, anon, authenticated;
revoke execute on function enqueue_scheduled_notifications() from public, anon, authenticated;
revoke execute on function post_venue_reveal_messages() from public, anon, authenticated;
