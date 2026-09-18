-- ============================================
-- 0099_revert_event_highlights_feedback.sql
--
-- Parking the event-highlights feedback feature (0090) for a future update —
-- founder decided 2026-09-18 not to ship it in this one. Reverts the schema
-- and storage side; the admin review page and the mobile feedback screen
-- (which was still uncommitted work-in-progress, never shipped) were removed
-- alongside this in the same pass. Full spec and the parked code live in
-- docs/deferred/event-highlights-feedback/.
--
-- Guarded with if exists / if not found checks so this is safe to run
-- whether or not 0090 actually landed on the target database (e.g. prod,
-- which was still on dev-only deploys as of this migration).
--
-- The bucket row itself is left in place, empty and now unreachable (its
-- policies are dropped below) rather than deleted — Supabase rejects a
-- direct `delete from storage.buckets`, requiring the Storage API instead,
-- which isn't worth wiring up for a migration reverting a feature that was
-- never live.
-- ============================================

drop policy if exists "self upload own event highlight" on storage.objects;
drop policy if exists "admin read event highlights" on storage.objects;

alter table feedback drop constraint if exists feedback_media_consent_required;
alter table feedback drop column if exists media_path;
alter table feedback drop column if exists media_consent;
