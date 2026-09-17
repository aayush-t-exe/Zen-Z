-- ============================================
-- 018_feedback_media_consent.sql
--
-- feedback_media_consent_required (0090_event_highlights_feedback.sql) is
-- the hard backstop for the post-event feedback screen's optional photo
-- upload: a submitted photo very likely includes groupmates who never
-- consented themselves, so a media_path can never be stored without the
-- submitter's consent checkbox also being true — checked here at the DB
-- level, not just trusted from the client.
-- ============================================

begin;

create temp table pgtap_output (line text);
grant insert, select on pgtap_output to authenticated, anon;

insert into pgtap_output select plan(3);

-- ---- fixtures ----
insert into auth.users (id, email) values
  ('a8000000-0000-0000-0000-000000000001', 'pgtap-feedback-media@test.local');

insert into activity_types (id, name, min_group_size, max_group_size)
  values (90008, 'pgtap MEDIA Cafe', 2, 2);
insert into slots (id, activity_type_id, slot_datetime)
  values ('b8000000-0000-0000-0000-000000000001', 90008, now() - interval '1 day');
insert into bookings (id, user_id, slot_id, status, payment_status, group_preference) values
  ('e8000000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-000000000001',
    'b8000000-0000-0000-0000-000000000001', 'matched', 'paid', 'mixed');

-- ---- as the booking's own student ----
select set_config('request.jwt.claims', json_build_object('sub', 'a8000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into pgtap_output select throws_ok(
  $$insert into feedback (booking_id, rating, would_repeat, media_path, media_consent)
    values ('e8000000-0000-0000-0000-000000000001', 5, 'yes', 'e8000000-0000-0000-0000-000000000001/x.jpg', false)$$,
  null, null,
  'a media_path without media_consent is rejected, even from the booking owner'
);

insert into pgtap_output select lives_ok(
  $$insert into feedback (booking_id, rating, would_repeat, media_path, media_consent)
    values ('e8000000-0000-0000-0000-000000000001', 5, 'yes', 'e8000000-0000-0000-0000-000000000001/x.jpg', true)$$,
  'a media_path with media_consent = true succeeds'
);

insert into pgtap_output select lives_ok(
  $$insert into feedback (booking_id, rating, would_repeat)
    values ('e8000000-0000-0000-0000-000000000001', 4, 'maybe')$$,
  'feedback with no media at all still succeeds (media stays fully optional)'
);

insert into pgtap_output select * from finish();

select * from pgtap_output;

rollback;
