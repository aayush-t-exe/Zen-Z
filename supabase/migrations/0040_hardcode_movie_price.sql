-- 0040_hardcode_movie_price.sql
-- Interim fix: Movies was charging the same flat convenience_fee (₹21) as
-- every other activity, with no ticket-price or GST component at all —
-- undercharging whenever the actual ticket costs more than that. Real
-- per-group ticket pricing (varies by which theater/movie the founder
-- assigns, only known at match time) is a bigger change involving the
-- groups table and a second payment step — deferred for now. As a stopgap,
-- Movies charges a single hardcoded ₹126 flat (covers ticket + GST at
-- today's ~₹95 price point + convenience fee) until that's built.

update activity_types set convenience_fee = 126 where name = 'Movies';
