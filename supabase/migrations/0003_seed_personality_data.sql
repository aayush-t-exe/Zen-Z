-- ============================================
-- 0003_seed_personality_data.sql
-- Seed the personality system with 5 dimensions
-- and 5 data-driven questions. All fully
-- configurable; can be updated/extended later
-- without any frontend or backend code changes.
-- ============================================

-- ============================================
-- DIMENSIONS (5 core personality traits)
-- ============================================
insert into personality_dimensions (key, label) values
  ('adventurous', 'Adventurous'),
  ('social', 'Social'),
  ('curious', 'Curious'),
  ('chill', 'Chill'),
  ('deep', 'Deep');

-- ============================================
-- QUESTION 1: New venue comfort level
-- ============================================
insert into personality_questions (prompt, question_type, display_order, is_active) values
  ('When trying a new café or restaurant, you...', 'single_select', 1, true);

insert into personality_question_options (question_id, label, display_order) values
  (1, 'Always research reviews first', 1),
  (1, 'Go with the flow', 2),
  (1, 'Ask friends for recommendations', 3),
  (1, 'Feel a bit nervous about unknowns', 4);

-- Q1 Option weights: maps each option to dimensions
-- Option 1: "Always research reviews first" → Curious (+0.7), -Adventurous (-0.5)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (1, 3, 0.7),   -- curious
  (1, 1, -0.5);  -- not adventurous

-- Option 2: "Go with the flow" → Adventurous (+0.8), Chill (+0.6)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (2, 1, 0.8),   -- adventurous
  (2, 4, 0.6);   -- chill

-- Option 3: "Ask friends for recommendations" → Social (+0.7), Curious (+0.5)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (3, 2, 0.7),   -- social
  (3, 3, 0.5);   -- curious

-- Option 4: "Feel a bit nervous" → -Adventurous (-0.7), Deep (+0.4)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (4, 1, -0.7),  -- not adventurous
  (4, 5, 0.4);   -- deep

-- ============================================
-- QUESTION 2: Social dynamics in groups
-- ============================================
insert into personality_questions (prompt, question_type, display_order, is_active) values
  ('At a table with people you''ve just met, you tend to...', 'single_select', 2, true);

insert into personality_question_options (question_id, label, display_order) values
  (2, 'Lead the conversation and set the tone', 1),
  (2, 'Listen carefully and observe first', 2),
  (2, 'Make jokes and keep the energy light', 3),
  (2, 'Ask questions and find common ground', 4);

-- Option 5: "Lead the conversation" → Social (+0.9)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (5, 2, 0.9);   -- social

-- Option 6: "Listen and observe" → Deep (+0.8), Curious (+0.6)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (6, 5, 0.8),   -- deep
  (6, 3, 0.6);   -- curious

-- Option 7: "Make jokes and keep it light" → Social (+0.7), Chill (+0.8)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (7, 2, 0.7),   -- social
  (7, 4, 0.8);   -- chill

-- Option 8: "Ask questions and find common ground" → Social (+0.6), Curious (+0.7), Deep (+0.5)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (8, 2, 0.6),   -- social
  (8, 3, 0.7),   -- curious
  (8, 5, 0.5);   -- deep

-- ============================================
-- QUESTION 3: Ideal evening type
-- ============================================
insert into personality_questions (prompt, question_type, display_order, is_active) values
  ('Your ideal evening with new friends would be...', 'single_select', 3, true);

insert into personality_question_options (question_id, label, display_order) values
  (3, 'Deep conversations about life, values, and ideas', 1),
  (3, 'Lots of laughter and creating inside jokes together', 2),
  (3, 'Trying something completely new and unexpected', 3),
  (3, 'Relaxed, peaceful time with good people', 4);

-- Option 9: "Deep conversations" → Deep (+0.9), Curious (+0.7)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (9, 5, 0.9),   -- deep
  (9, 3, 0.7);   -- curious

-- Option 10: "Lots of laughter" → Social (+0.8), Chill (+0.9)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (10, 2, 0.8),  -- social
  (10, 4, 0.9);  -- chill

-- Option 11: "Trying something new" → Adventurous (+0.9), Social (+0.5)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (11, 1, 0.9),  -- adventurous
  (11, 2, 0.5);  -- social

-- Option 12: "Relaxed, peaceful time" → Chill (+0.8), Deep (+0.6)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (12, 4, 0.8),  -- chill
  (12, 5, 0.6);  -- deep

-- ============================================
-- QUESTION 4: Handling unexpected changes
-- ============================================
insert into personality_questions (prompt, question_type, display_order, is_active) values
  ('When plans change unexpectedly at the last minute, you...', 'single_select', 4, true);

insert into personality_question_options (question_id, label, display_order) values
  (4, 'Get excited about new possibilities', 1),
  (4, 'Feel stressed and prefer knowing what''s ahead', 2),
  (4, 'Go with it—no big deal', 3),
  (4, 'Quickly brainstorm alternatives', 4);

-- Option 13: "Get excited about new possibilities" → Adventurous (+0.8), Social (+0.6)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (13, 1, 0.8),  -- adventurous
  (13, 2, 0.6);  -- social

-- Option 14: "Feel stressed" → -Adventurous (-0.8), -Chill (-0.8), Deep (+0.5)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (14, 1, -0.8), -- not adventurous
  (14, 4, -0.8), -- not chill
  (14, 5, 0.5);  -- deep

-- Option 15: "Go with it" → Chill (+0.9), Adventurous (+0.6)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (15, 4, 0.9),  -- chill
  (15, 1, 0.6);  -- adventurous

-- Option 16: "Brainstorm alternatives" → Curious (+0.8), Deep (+0.6)
insert into personality_option_weights (option_id, dimension_id, weight) values
  (16, 3, 0.8),  -- curious
  (16, 5, 0.6);  -- deep

-- ============================================
-- QUESTION 5: Adventurousness scale (0-10)
-- ============================================
insert into personality_questions (prompt, question_type, display_order, is_active) values
  ('From "prefer to stick with what I know" to "always up for something completely new"', 'scale', 5, true);

-- Scale mapping: directly maps the 0-10 scale to Adventurous dimension
insert into personality_scale_mappings (question_id, dimension_id, multiplier) values
  (5, 1, 1.0);  -- 0-10 scale maps 1:1 to adventurous dimension
