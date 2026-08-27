-- ============================================
-- 0052_personality_quiz_v2.sql
-- Replaces the 5-question quiz with a new
-- 10-question, scenario-based set (founder
-- request, 2026-08-26). Fully data-driven per
-- CLAUDE.md — no frontend/backend code changes.
--
-- - Old questions are deactivated (is_active =
--   false), not deleted, so existing
--   personality_answers / personality_scores
--   rows for students who already took the old
--   quiz stay intact.
-- - Adds two new dimensions: "competitive" and
--   "energy" (extrovert/introvert recharge —
--   distinct from "social", which measures
--   leading/energizing a group, not recharging
--   from it).
-- - Q9 (ideal group size) is a logistics
--   preference, not a personality trait — it's
--   stored like every other question but
--   intentionally has no personality_option_weights
--   rows, so score-personality/logic.ts skips it
--   automatically (nothing to change there).
-- ============================================

do $$
declare
  dim_adventurous int;
  dim_social int;
  dim_curious int;
  dim_chill int;
  dim_deep int;
  dim_competitive int;
  dim_energy int;
  q_id int;
  opt_a int;
  opt_b int;
  opt_c int;
  opt_d int;
begin
  select id into dim_adventurous from personality_dimensions where key = 'adventurous';
  select id into dim_social from personality_dimensions where key = 'social';
  select id into dim_curious from personality_dimensions where key = 'curious';
  select id into dim_chill from personality_dimensions where key = 'chill';
  select id into dim_deep from personality_dimensions where key = 'deep';

  insert into personality_dimensions (key, label) values ('competitive', 'Competitive')
    returning id into dim_competitive;
  insert into personality_dimensions (key, label) values ('energy', 'Energy')
    returning id into dim_energy;

  -- Retire the old quiz. is_active = false, not deleted.
  update personality_questions set is_active = false where is_active = true;

  -- ============================================
  -- Q1: role in a small group
  -- ============================================
  insert into personality_questions (prompt, question_type, display_order, is_active) values
    ('You''re hanging out with 4-5 people. Without overthinking, what''s usually true about you?', 'single_select', 1, true)
    returning id into q_id;

  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'I''m the one initiating ideas and keeping the energy up', 1) returning id into opt_a;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'I ask great questions and bring out other people''s stories', 2) returning id into opt_b;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'I go where the group goes', 3) returning id into opt_c;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'I notice when someone''s quiet and make sure they feel included', 4) returning id into opt_d;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (opt_a, dim_social, 0.9),
    (opt_b, dim_curious, 0.8), (opt_b, dim_deep, 0.3),
    (opt_c, dim_chill, 0.8),
    (opt_d, dim_deep, 0.5), (opt_d, dim_social, 0.4);

  -- ============================================
  -- Q2: conversation depth at a group dinner
  -- ============================================
  insert into personality_questions (prompt, question_type, display_order, is_active) values
    ('You''re 30 minutes into a group dinner. The conversation is...', 'single_select', 2, true)
    returning id into q_id;

  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Light and funny—everyone''s trading jokes and banter', 1) returning id into opt_a;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Someone brought up something real and you''re diving deep', 2) returning id into opt_b;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Mix of both—funny for a bit, then it naturally gets deeper', 3) returning id into opt_c;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'I''m mostly listening and asking questions', 4) returning id into opt_d;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (opt_a, dim_chill, 0.6), (opt_a, dim_social, 0.6),
    (opt_b, dim_deep, 0.9),
    (opt_c, dim_deep, 0.5), (opt_c, dim_chill, 0.4),
    (opt_d, dim_curious, 0.7), (opt_d, dim_deep, 0.3);

  -- ============================================
  -- Q3: picking the restaurant
  -- ============================================
  insert into personality_questions (prompt, question_type, display_order, is_active) values
    ('A group is picking a restaurant for dinner. Where do you lean?', 'single_select', 3, true)
    returning id into q_id;

  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'That new experimental spot everyone''s talking about', 1) returning id into opt_a;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'A solid place I love and trust', 2) returning id into opt_b;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Depends on the group and budget that night', 3) returning id into opt_c;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Casual spot—less deciding, more time together', 4) returning id into opt_d;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (opt_a, dim_adventurous, 0.9),
    (opt_b, dim_adventurous, -0.7),
    (opt_c, dim_chill, 0.5),
    (opt_d, dim_chill, 0.8);

  -- ============================================
  -- Q4: natural mode during a 2hr cafe hangout
  -- ============================================
  insert into personality_questions (prompt, question_type, display_order, is_active) values
    ('You''re at a cafe with friends for 2 hours. Your natural mode is...', 'single_select', 4, true)
    returning id into q_id;

  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Focused work time—I''m here to get stuff done', 1) returning id into opt_a;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Full social hangout—the cafe is just our backdrop', 2) returning id into opt_b;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Mixed rhythm—work a bit, then chat, back and forth', 3) returning id into opt_c;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Solo time with company—I''m doing my own thing, but I like being around people', 4) returning id into opt_d;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (opt_a, dim_energy, -0.6),
    (opt_b, dim_social, 0.7), (opt_b, dim_energy, 0.7),
    (opt_c, dim_chill, 0.5),
    (opt_d, dim_energy, -0.7);

  -- ============================================
  -- Q5: energy during casual sports
  -- ============================================
  insert into personality_questions (prompt, question_type, display_order, is_active) values
    ('You''re playing casual sports with new people. Your energy is...', 'single_select', 5, true)
    returning id into q_id;

  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Here to compete and push myself—I''m playing to win', 1) returning id into opt_a;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Here for the laugh and the bonding—competition is secondary', 2) returning id into opt_b;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'I just want to move and feel active—competition level doesn''t matter', 3) returning id into opt_c;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Casual, but I like knowing the rules and structure', 4) returning id into opt_d;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (opt_a, dim_competitive, 0.9),
    (opt_b, dim_social, 0.6), (opt_b, dim_chill, 0.4),
    (opt_c, dim_chill, 0.7),
    (opt_d, dim_chill, 0.3), (opt_d, dim_adventurous, -0.4);

  -- ============================================
  -- Q6: plans change last-minute
  -- ============================================
  insert into personality_questions (prompt, question_type, display_order, is_active) values
    ('Friday night plan with friends. Plans change unexpectedly at the last minute. You...', 'single_select', 6, true)
    returning id into q_id;

  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Get excited about the new possibilities', 1) returning id into opt_a;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Need a moment to adjust—you think better with a game plan', 2) returning id into opt_b;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Go with it—no big deal', 3) returning id into opt_c;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Quickly brainstorm alternatives', 4) returning id into opt_d;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (opt_a, dim_adventurous, 0.8),
    (opt_b, dim_adventurous, -0.8),
    (opt_c, dim_chill, 0.9),
    (opt_d, dim_curious, 0.8), (opt_d, dim_deep, 0.4);

  -- ============================================
  -- Q7: energy leaving a hangout
  -- ============================================
  insert into personality_questions (prompt, question_type, display_order, is_active) values
    ('You just spent 2+ hours hanging out with a group (movie, dinner, cafe). As you''re leaving...', 'single_select', 7, true)
    returning id into q_id;

  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'I still have a lot of energy—I could hang out longer or do it again', 1) returning id into opt_a;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'I feel satisfied and I''m ready for some time alone', 2) returning id into opt_b;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'It depends on the group''s vibe and how connected I felt', 3) returning id into opt_c;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'I''m completely drained—I need some quality alone time to recharge', 4) returning id into opt_d;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (opt_a, dim_energy, 0.9),
    (opt_b, dim_energy, -0.5),
    (opt_c, dim_chill, 0.4),
    (opt_d, dim_energy, -0.9);

  -- ============================================
  -- Q8: social consistency week to week
  -- ============================================
  insert into personality_questions (prompt, question_type, display_order, is_active) values
    ('Thinking about how much you want to socialize from week to week...', 'single_select', 8, true)
    returning id into q_id;

  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Pretty consistent—I usually feel like hanging out', 1) returning id into opt_a;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'It changes a lot from one week to another', 2) returning id into opt_b;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'I need regular quiet time to recharge, even though I enjoy being social', 3) returning id into opt_c;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'New and different things give me energy—I get bored easily', 4) returning id into opt_d;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (opt_a, dim_energy, 0.6),
    (opt_b, dim_chill, -0.3),
    (opt_c, dim_energy, -0.7),
    (opt_d, dim_adventurous, 0.8), (opt_d, dim_energy, 0.3);

  -- ============================================
  -- Q9: ideal group size — stored, not scored.
  -- Intentionally no personality_option_weights
  -- rows for these options; this is a logistics
  -- preference, not a trait to match on.
  -- ============================================
  insert into personality_questions (prompt, question_type, display_order, is_active) values
    ('For a hangout (movie, dinner, cafe session), your ideal group size is...', 'single_select', 9, true)
    returning id into q_id;

  insert into personality_question_options (question_id, label, display_order) values
    (q_id, '3-4 people—I like being able to actually talk to everyone', 1);
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, '4-5 people—the sweet spot', 2);
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, '5-6 people—more energy, more perspectives', 3);
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Flexible—doesn''t really matter as long as vibes are right', 4);

  -- ============================================
  -- Q10: what makes you want to hang again
  -- ============================================
  insert into personality_questions (prompt, question_type, display_order, is_active) values
    ('After a hangout where you met someone new and thought "I''d definitely hang with them again," it''s usually because...', 'single_select', 10, true)
    returning id into q_id;

  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'You have shared interests, goals, or hobbies', 1) returning id into opt_a;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'Your personalities just clicked—similar or complementary energy', 2) returning id into opt_b;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'They''re a genuinely good listener and you felt heard', 3) returning id into opt_c;
  insert into personality_question_options (question_id, label, display_order) values
    (q_id, 'You have similar values or can talk about real stuff', 4) returning id into opt_d;

  insert into personality_option_weights (option_id, dimension_id, weight) values
    (opt_a, dim_curious, 0.7),
    (opt_b, dim_social, 0.7),
    (opt_c, dim_deep, 0.5), (opt_c, dim_curious, 0.2),
    (opt_d, dim_deep, 0.9);
end $$;
