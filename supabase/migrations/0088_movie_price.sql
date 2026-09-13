-- ============================================
-- 0088_movie_price.sql
--
-- Founder request: a new release can't reasonably cost the same flat ₹126
-- every other Movies slot charges (0040_hardcode_movie_price.sql), but
-- that flat fee still has to stay the default for everything else. Each movie
-- now carries its own price, defaulting to today's Movies convenience_fee
-- — the founder can raise it per title (e.g. for a new release) when
-- adding or editing that movie in the admin dashboard.
--
-- This only ever applies to a choose_movie booking, which is the one case
-- where the student is looking at a specific title (and its price) before
-- paying. A surprise_me booking never learns which movie it'll get until
-- the founder assigns one post-match, so it keeps paying the flat
-- activity-level convenience_fee regardless of what that group ends up
-- watching — the whole point of "surprise me" is not needing to price
-- anything upfront.
-- ============================================

alter table movies add column price int not null default 126 check (price > 0);
