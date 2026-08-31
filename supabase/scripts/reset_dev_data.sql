-- ============================================
-- reset_dev_data.sql
--
-- Wipes every student-generated record (bookings, groups, chat, personality
-- quiz answers/scores, reports, etc.) AND every non-admin account, leaving
-- a completely clean slate for testing. Admin accounts (anything in
-- admin_users) are preserved so you don't get locked out of the dashboard.
--
-- This is a DATA reset, not a schema change — it doesn't belong in
-- supabase/migrations (see CLAUDE.md: migrations are for schema changes
-- only) and running it doesn't need a "migration" applied anywhere.
--
-- ⚠️ NEVER run this against campus-social-prod. Real students, real money.
-- This is safe on campus-social-dev only.
--
-- ============================================
-- HOW TO RUN THIS YOURSELF
-- ============================================
-- Option A — Supabase Dashboard (easiest, no setup needed):
--   1. Go to supabase.com/dashboard, open the campus-social-dev project.
--   2. Left sidebar → SQL Editor → "+ New query".
--   3. Paste this entire file's contents in.
--   4. Click "Run" (or Ctrl/Cmd+Enter).
--   5. Double-check the project name in the top-left says "campus-social-dev"
--      before you hit Run — the SQL Editor works the same on every project,
--      including prod, and nothing else will stop you.
--
-- Option B — Supabase CLI, from the repo root:
--   npx supabase db query --linked -f supabase/scripts/reset_dev_data.sql
--   ("--linked" only works if this repo is linked to campus-social-dev,
--   which it already is — check with `npx supabase projects list` if
--   you're ever unsure which project "linked" currently points at.)
-- ============================================

begin;

-- Booking / group / chat / moderation data
delete from messages;
delete from reports;
delete from feedback;
delete from no_shows;
delete from group_members;
delete from groups;
delete from bookings;
delete from notifications_outbox;

-- Personality quiz progress
delete from personality_answers;
delete from personality_scores;

-- Every non-admin account. auth.users cascade-deletes its own profiles
-- row (profiles.id references auth.users(id) on delete cascade), which
-- in turn takes personality_answers/scores and notifications_outbox with
-- it for that user too — nothing above is strictly needed for THIS part
-- to work, but running both together is what "reset everything" means in
-- practice, and it's clearer to read as two explicit steps.
delete from auth.users
where id not in (select id from admin_users);

commit;

-- Sanity check — everything below should read 0 except admin_users/profiles
-- (which should match your real admin count, e.g. 2).
select 'bookings' as t, count(*) from bookings
union all select 'groups', count(*) from groups
union all select 'messages', count(*) from messages
union all select 'personality_answers', count(*) from personality_answers
union all select 'personality_scores', count(*) from personality_scores
union all select 'profiles (should be admin count only)', count(*) from profiles;
