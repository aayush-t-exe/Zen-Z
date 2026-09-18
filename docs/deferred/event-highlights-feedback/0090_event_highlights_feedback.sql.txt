-- ============================================
-- 0090_event_highlights_feedback.sql
--
-- Fills a gap found live: the post_event_feedback push notification
-- ("How did your story end tonight?") has fired for every event since
-- 0019, but there has never been a screen behind it — the feedback table
-- (0001_init.sql) has zero writes from the mobile app. This adds the
-- storage side of the actual feedback screen: an optional photo the
-- student can submit from the event, which the founder can review and
-- use on @zen_z.app.
--
-- media_consent is a hard DB constraint, not just a client-side checkbox —
-- a submitted photo very likely includes groupmates who never agreed to
-- anything themselves. The submitting student can only consent for
-- themselves, so the checkbox is them attesting their group is fine with
-- it, not a substitute for their groupmates' own consent; there is no
-- mechanism here to actually verify that. This is the founder's call to
-- accept that tradeoff (confirmed 2026-09-14), not a technical guarantee.
-- ============================================

alter table feedback add column media_path text;
alter table feedback add column media_consent boolean not null default false;

alter table feedback add constraint feedback_media_consent_required
  check (media_path is null or media_consent = true);

-- ---------- storage: event-highlights bucket ----------
-- Private, founder-reviewed-before-posting — never auto-published, same
-- private-by-default posture as profile-photos. Path convention:
-- event-highlights/{booking_id}/{filename}.

insert into storage.buckets (id, name, public) values ('event-highlights', 'event-highlights', false);

create policy "self upload own event highlight" on storage.objects
  for insert with check (
    bucket_id = 'event-highlights'
    and (storage.foldername(name))[1]::uuid in (select id from bookings where user_id = auth.uid())
  );

create policy "admin read event highlights" on storage.objects
  for select using (
    bucket_id = 'event-highlights' and auth.uid() in (select id from admin_users)
  );
