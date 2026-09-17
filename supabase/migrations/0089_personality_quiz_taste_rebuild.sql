-- ============================================
-- 0089_personality_quiz_taste_rebuild.sql
--
-- Full rebuild of the personality quiz, founder request (2026-09-14).
-- The old 6-question/7-dimension quiz (adventurous, social, curious, chill,
-- deep, competitive, energy) measured social *temperament* — group role,
-- competitiveveness, spontaneity, social battery — not the thing the app
-- was actually supposed to match people on: shared taste, humor, and
-- opinions ("like-minded", not just "similar energy"). Two people could
-- score identically on every old dimension and still have nothing to talk
-- about.
--
-- Old questions/options/weights/scale-mappings are deactivated, not
-- deleted — personality_answers rows from students who already took the
-- old quiz reference them by FK (same convention as 0082/0083). Old
-- dimension rows (adventurous/social/curious/chill/deep/competitive) are
-- left in place for the same reason; they simply stop receiving new
-- answers once their only questions are inactive.
--
-- Kept as-is: the "What's your social energy like?" scale question (id 5,
-- dimension 'energy') — genuinely useful for activity logistics (pacing a
-- Dinner, energy-matching a Sports group), moved to display_order 8 (last),
-- same position it held in the original 10-question quiz before trimming.
--
-- New questions (display_order 1-7), each multi-select tag mapping 1:1 to
-- its own new dimension (weight 1.0 when picked) so cosine similarity
-- across them behaves like tag-overlap, or a 3-tier scale mirroring the
-- existing personality_scale_labels pattern:
--   1. Interest tags       — what you're actually into
--   2. Taste-positioning   — mainstream/blockbuster vs. arthouse/cerebral
--   3. Hot takes           — opinions on everyday social situations
--   4. Music taste         — genre tags
--   5. Daily rhythm        — early riser vs. night owl
--   6. Lifestyle tags      — foodie/fitness/homebody/spontaneous/hobbyist
--   7. Food preferences    — cuisine/spice/dining-style tags
--
-- Deliberately NOT included: a "humor style" question. Attempted and
-- dropped during drafting — current/authentic meme-based humor examples
-- can't be credibly authored without live cultural input from actual
-- students, and Q1's "memes/brainrot" interest tag already captures a
-- meaningful chunk of that signal. Left as a future addition once real
-- example content exists (data-only, per docs/PERSONALITY.md).
--
-- Also deliberately NOT included: veg/non-veg. That's a dietary fact, not
-- a taste signal — mixing it into a soft cosine-similarity score is the
-- wrong mechanism. If it's ever needed, it belongs as a hard constraint
-- alongside the existing gender/group_preference filters, not here.
-- ============================================

-- ---------- deactivate the old quiz ----------

update personality_questions
set is_active = false
where id in (6, 10, 11, 13, 15);

update personality_questions
set display_order = 8
where id = 5;

-- ============================================
-- Q1 — Interest tags
-- ============================================
do $$
declare
  v_q int;
  v_o1 int; v_o2 int; v_o3 int; v_o4 int; v_o5 int;
  v_o6 int; v_o7 int; v_o8 int; v_o9 int; v_o10 int;
begin
  insert into personality_dimensions (key, label) values
    ('interest_standup', 'Into stand-up/comedy podcasts'),
    ('interest_bollywood_mass', 'Into mass/masala Bollywood-action'),
    ('interest_arthouse_film', 'Into slow-burn/arthouse film'),
    ('interest_anime', 'Into anime'),
    ('interest_sports', 'Into cricket/football'),
    ('interest_gaming', 'Into gaming'),
    ('interest_kpop', 'Into K-pop/K-drama'),
    ('interest_memes', 'Into meme/brainrot internet humor'),
    ('interest_truecrime', 'Into true crime/documentaries'),
    ('interest_livegigs', 'Into live gigs/festivals');

  insert into personality_questions (prompt, question_type, display_order, is_active)
  values ('Which of these are genuinely "your thing"? Pick as many as fit.', 'multi_select', 1, true)
  returning id into v_q;

  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Stand-up specials & comedy podcasts', 1) returning id into v_o1;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Mass, masala, everyone''s-hyped Bollywood/action', 2) returning id into v_o2;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Slow-burn, arthouse, "wait for the third act" films', 3) returning id into v_o3;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Anime', 4) returning id into v_o4;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Cricket/football — watching or playing', 5) returning id into v_o5;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Gaming (console, PC, or mobile)', 6) returning id into v_o6;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'K-pop, K-drama', 7) returning id into v_o7;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Meme pages, reels, "brainrot" internet humor', 8) returning id into v_o8;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'True crime, documentaries, deep-dive YouTube', 9) returning id into v_o9;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Live gigs, music festivals', 10) returning id into v_o10;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (v_o1, (select id from personality_dimensions where key = 'interest_standup'), 1.0),
    (v_o2, (select id from personality_dimensions where key = 'interest_bollywood_mass'), 1.0),
    (v_o3, (select id from personality_dimensions where key = 'interest_arthouse_film'), 1.0),
    (v_o4, (select id from personality_dimensions where key = 'interest_anime'), 1.0),
    (v_o5, (select id from personality_dimensions where key = 'interest_sports'), 1.0),
    (v_o6, (select id from personality_dimensions where key = 'interest_gaming'), 1.0),
    (v_o7, (select id from personality_dimensions where key = 'interest_kpop'), 1.0),
    (v_o8, (select id from personality_dimensions where key = 'interest_memes'), 1.0),
    (v_o9, (select id from personality_dimensions where key = 'interest_truecrime'), 1.0),
    (v_o10, (select id from personality_dimensions where key = 'interest_livegigs'), 1.0);
end $$;

-- ============================================
-- Q2 — Taste-positioning (3-tier scale)
-- ============================================
do $$
declare
  v_q int;
begin
  insert into personality_dimensions (key, label) values ('taste_arthouse', 'Arthouse-leaning taste');

  insert into personality_questions (prompt, question_type, display_order, is_active)
  values ('Your taste in movies/shows leans more...', 'scale', 2, true)
  returning id into v_q;

  insert into personality_scale_mappings (question_id, dimension_id, multiplier)
  values (v_q, (select id from personality_dimensions where key = 'taste_arthouse'), 1);

  insert into personality_scale_labels (question_id, tier, label, description) values
    (v_q, 0, 'Give me the popcorn blockbuster', 'I want the big, mass, everyone''s-watching-it movie.'),
    (v_q, 1, 'Honestly depends on my mood', 'I''ll happily watch either, no strong lean.'),
    (v_q, 2, 'Slower, weirder, the kind you think about after', 'I lean arthouse/cerebral over mass-market.');
end $$;

-- ============================================
-- Q3 — Hot takes
-- ============================================
do $$
declare
  v_q int;
  v_o1 int; v_o2 int; v_o3 int; v_o4 int; v_o5 int; v_o6 int;
begin
  insert into personality_dimensions (key, label) values
    ('opinion_smalltalk_tax', 'Sees small talk as a tax before real conversation'),
    ('opinion_plans_not_deep', 'Last-minute plan changes are not a big deal'),
    ('opinion_ghosting_ok', 'Ghosting a non-vibe is fine'),
    ('opinion_no_fixed_plan', 'Prefers group hangouts with no fixed plan'),
    ('opinion_honesty_over_comfort', 'Values honesty over comfort'),
    ('opinion_overthink_normal', 'Sees overthinking texts as normal');

  insert into personality_questions (prompt, question_type, display_order, is_active)
  values ('Which of these do you actually agree with?', 'multi_select', 3, true)
  returning id into v_q;

  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Small talk is basically a tax you pay before the real conversation starts', 1) returning id into v_o1;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'If plans fall through last minute, it''s not that deep', 2) returning id into v_o2;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'It''s okay to ghost someone you clearly don''t vibe with', 3) returning id into v_o3;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Group hangouts are better with no fixed plan', 4) returning id into v_o4;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Honesty over comfort, even if it stings a little', 5) returning id into v_o5;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Overthinking every text before sending is completely normal', 6) returning id into v_o6;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (v_o1, (select id from personality_dimensions where key = 'opinion_smalltalk_tax'), 1.0),
    (v_o2, (select id from personality_dimensions where key = 'opinion_plans_not_deep'), 1.0),
    (v_o3, (select id from personality_dimensions where key = 'opinion_ghosting_ok'), 1.0),
    (v_o4, (select id from personality_dimensions where key = 'opinion_no_fixed_plan'), 1.0),
    (v_o5, (select id from personality_dimensions where key = 'opinion_honesty_over_comfort'), 1.0),
    (v_o6, (select id from personality_dimensions where key = 'opinion_overthink_normal'), 1.0);
end $$;

-- ============================================
-- Q4 — Music taste
-- ============================================
do $$
declare
  v_q int;
  v_o1 int; v_o2 int; v_o3 int; v_o4 int; v_o5 int; v_o6 int; v_o7 int; v_o8 int; v_o9 int;
begin
  insert into personality_dimensions (key, label) values
    ('music_bollywood_hindi', 'Into Bollywood/Hindi pop'),
    ('music_punjabi_hiphop', 'Into Punjabi/hip-hop'),
    ('music_english_pop', 'Into English pop/Top 40'),
    ('music_indie_alt', 'Into indie/alternative'),
    ('music_edm_festival', 'Into EDM/festival'),
    ('music_hiphop_rap', 'Into hip-hop/rap'),
    ('music_lofi_chill', 'Into lo-fi/chill'),
    ('music_rock_metal', 'Into rock/metal'),
    ('music_devotional_classical', 'Into devotional/classical Indian music');

  insert into personality_questions (prompt, question_type, display_order, is_active)
  values ('What''s in your rotation? Pick as many as fit.', 'multi_select', 4, true)
  returning id into v_q;

  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Bollywood/Hindi pop', 1) returning id into v_o1;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Punjabi/hip-hop', 2) returning id into v_o2;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'English pop/Top 40', 3) returning id into v_o3;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Indie/alternative', 4) returning id into v_o4;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'EDM/festival', 5) returning id into v_o5;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Hip-hop/rap', 6) returning id into v_o6;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Lo-fi/chill', 7) returning id into v_o7;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Rock/metal', 8) returning id into v_o8;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Devotional/classical Indian', 9) returning id into v_o9;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (v_o1, (select id from personality_dimensions where key = 'music_bollywood_hindi'), 1.0),
    (v_o2, (select id from personality_dimensions where key = 'music_punjabi_hiphop'), 1.0),
    (v_o3, (select id from personality_dimensions where key = 'music_english_pop'), 1.0),
    (v_o4, (select id from personality_dimensions where key = 'music_indie_alt'), 1.0),
    (v_o5, (select id from personality_dimensions where key = 'music_edm_festival'), 1.0),
    (v_o6, (select id from personality_dimensions where key = 'music_hiphop_rap'), 1.0),
    (v_o7, (select id from personality_dimensions where key = 'music_lofi_chill'), 1.0),
    (v_o8, (select id from personality_dimensions where key = 'music_rock_metal'), 1.0),
    (v_o9, (select id from personality_dimensions where key = 'music_devotional_classical'), 1.0);
end $$;

-- ============================================
-- Q5 — Daily rhythm (3-tier scale)
-- ============================================
do $$
declare
  v_q int;
begin
  insert into personality_dimensions (key, label) values ('rhythm_nightowl', 'Night-owl leaning');

  insert into personality_questions (prompt, question_type, display_order, is_active)
  values ('Your natural rhythm is...', 'scale', 5, true)
  returning id into v_q;

  insert into personality_scale_mappings (question_id, dimension_id, multiplier)
  values (v_q, (select id from personality_dimensions where key = 'rhythm_nightowl'), 1);

  insert into personality_scale_labels (question_id, tier, label, description) values
    (v_q, 0, 'Early riser', 'Mornings are my prime time.'),
    (v_q, 1, 'Depends on the day', 'No strong lean either way.'),
    (v_q, 2, 'Night owl', 'I come alive after dark.');
end $$;

-- ============================================
-- Q6 — Lifestyle tags
-- ============================================
do $$
declare
  v_q int;
  v_o1 int; v_o2 int; v_o3 int; v_o4 int; v_o5 int;
begin
  insert into personality_dimensions (key, label) values
    ('lifestyle_foodie_explorer', 'Always hunting new places to eat'),
    ('lifestyle_fitness_routine', 'Has an actual gym/fitness routine'),
    ('lifestyle_homebody', 'Homebody, cozy nights in'),
    ('lifestyle_spontaneous', 'Down for anything spontaneous'),
    ('lifestyle_hobby_deepdive', 'Deep into one specific hobby/craft');

  insert into personality_questions (prompt, question_type, display_order, is_active)
  values ('Which of these sound like you? Pick as many as fit.', 'multi_select', 6, true)
  returning id into v_q;

  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Always hunting for new places to eat', 1) returning id into v_o1;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Has an actual gym/fitness routine', 2) returning id into v_o2;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Homebody who loves a cozy night in', 3) returning id into v_o3;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Down for anything spontaneous, no plan needed', 4) returning id into v_o4;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Deep into one specific hobby/craft', 5) returning id into v_o5;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (v_o1, (select id from personality_dimensions where key = 'lifestyle_foodie_explorer'), 1.0),
    (v_o2, (select id from personality_dimensions where key = 'lifestyle_fitness_routine'), 1.0),
    (v_o3, (select id from personality_dimensions where key = 'lifestyle_homebody'), 1.0),
    (v_o4, (select id from personality_dimensions where key = 'lifestyle_spontaneous'), 1.0),
    (v_o5, (select id from personality_dimensions where key = 'lifestyle_hobby_deepdive'), 1.0);
end $$;

-- ============================================
-- Q7 — Food preferences
-- ============================================
do $$
declare
  v_q int;
  v_o1 int; v_o2 int; v_o3 int; v_o4 int; v_o5 int; v_o6 int; v_o7 int;
begin
  insert into personality_dimensions (key, label) values
    ('food_north_indian', 'North Indian comfort food'),
    ('food_south_indian', 'South Indian classics'),
    ('food_street_food', 'Street food over sit-down'),
    ('food_new_cuisine', 'Chases new/unfamiliar cuisine'),
    ('food_spice_lover', 'The hotter the better'),
    ('food_company_over_food', 'Food is secondary to company'),
    ('food_dessert_cafehop', 'Dessert/cafe-hopping as a personality trait');

  insert into personality_questions (prompt, question_type, display_order, is_active)
  values ('Which of these are true for you? Pick as many as fit.', 'multi_select', 7, true)
  returning id into v_q;

  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'North Indian comfort food, always', 1) returning id into v_o1;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'South Indian classics over anything else', 2) returning id into v_o2;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Street food over a sit-down restaurant, any day', 3) returning id into v_o3;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Always chasing a new/unfamiliar cuisine', 4) returning id into v_o4;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Spice level: the hotter the better', 5) returning id into v_o5;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Honestly, it''s about the company — food''s secondary', 6) returning id into v_o6;
  insert into personality_question_options (question_id, label, display_order) values
    (v_q, 'Dessert/cafe-hopping is basically a personality trait', 7) returning id into v_o7;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (v_o1, (select id from personality_dimensions where key = 'food_north_indian'), 1.0),
    (v_o2, (select id from personality_dimensions where key = 'food_south_indian'), 1.0),
    (v_o3, (select id from personality_dimensions where key = 'food_street_food'), 1.0),
    (v_o4, (select id from personality_dimensions where key = 'food_new_cuisine'), 1.0),
    (v_o5, (select id from personality_dimensions where key = 'food_spice_lover'), 1.0),
    (v_o6, (select id from personality_dimensions where key = 'food_company_over_food'), 1.0),
    (v_o7, (select id from personality_dimensions where key = 'food_dessert_cafehop'), 1.0);
end $$;
