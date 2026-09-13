-- ============================================
-- 0087_drop_old_confirm_group_overload.sql
--
-- 0086_movies.sql's `create or replace function confirm_group(p_slot_id,
-- p_venue_id, p_booking_ids, p_movie_id default null)` added a fourth
-- parameter — Postgres resolves function identity by its full argument
-- list, so a changed signature creates a NEW overload rather than
-- replacing the old one (unlike every prior confirm_group migration,
-- 0017/0023/0058/0072, which all kept the exact same 3-argument signature
-- and so really did replace in place). The old 3-argument confirm_group()
-- was left behind, still callable, still missing the movie hard-check —
-- silently reintroducing the exact bug the new check exists to close for
-- anything that ever calls it with just 3 args. Drop it explicitly.
-- ============================================

drop function if exists confirm_group(uuid, uuid, uuid[]);
