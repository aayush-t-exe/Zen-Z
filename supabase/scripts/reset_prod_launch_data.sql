-- ============================================
-- reset_prod_launch_data.sql
--
-- One-time wipe of every pre-launch test/closed-testing account on
-- campus-social-prod, run 2026-09-22 right after the app's first Google
-- Play approval — see docs/PLAY_STORE_SUBMISSION.md and the founder's own
-- prior call to reset prod test data once the app actually launched (not
-- during closed testing).
--
-- Unlike supabase/scripts/reset_dev_data.sql (dev-only, predates the
-- referral system added in 0073_referral_redemption_and_credits.sql),
-- this also clears referral_credits/referral_redemptions/referrals and
-- explicitly protects the Play Store reviewer account in addition to
-- admin_users — deleting that account would silently break the reviewer
-- login bypass shipped today (supabase/functions/play-review-set-password,
-- apps/mobile's otp-verification.tsx PLAY_REVIEW_EMAIL branch), and
-- Google can re-review this app again in the future using those same
-- credentials.
--
-- Preview run beforehand (2026-09-22, via `supabase db query --linked`):
-- 59 total accounts, 1 admin, 1 Play reviewer, 57 to be deleted.
-- ============================================

begin;

-- Break the profiles<->referrals cycle first (profiles.referred_by_code
-- references referrals.code with no cascade) so the referrals delete
-- below doesn't fail on a still-referencing profile. Briefly disables
-- enforce_referred_by_code_immutable() — that trigger exists to stop a
-- *real user* changing their own code, not to block this one-time admin
-- reset; re-enabled immediately after, still inside this transaction.
alter table profiles disable trigger trg_referred_by_code_immutable;
update profiles set referred_by_code = null;
alter table profiles enable trigger trg_referred_by_code_immutable;

-- Referral system — not covered by reset_dev_data.sql, added after it.
delete from referral_credits;
delete from referral_redemptions;
delete from referrals
where owner_id not in (select id from admin_users)
  and owner_id <> (select id from auth.users where email = 'teamzenz.reviewer@gmail.com');

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

-- Every account except the admin login and the Play Store reviewer
-- account. auth.users cascade-deletes its own profiles row, which takes
-- personality_answers/scores and notifications_outbox with it too.
delete from auth.users
where id not in (select id from admin_users)
  and email <> 'teamzenz.reviewer@gmail.com';

commit;

-- Sanity check — everything below should read 0 except profiles/admin_users
-- (2: admin + Play reviewer) and referrals-family tables (0).
select 'bookings' as t, count(*) from bookings
union all select 'groups', count(*) from groups
union all select 'messages', count(*) from messages
union all select 'personality_answers', count(*) from personality_answers
union all select 'personality_scores', count(*) from personality_scores
union all select 'referrals', count(*) from referrals
union all select 'referral_redemptions', count(*) from referral_redemptions
union all select 'referral_credits', count(*) from referral_credits
union all select 'profiles (should be 2: admin + Play reviewer)', count(*) from profiles;
