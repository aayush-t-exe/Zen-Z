-- 0082 trimmed the 0052 question set to 6 but missed that
-- 0053_restore_social_energy_scale.sql reactivated an 11th question (the
-- intro/ambivert/extrovert scale, display_order 11) outside that set — so
-- the quiz was still at 7 active questions, not 6.
--
-- That scale question is a dedicated, stronger dim_energy signal than any
-- single_select option ever was, so "You're at a cafe with friends for 2
-- hours..." (dim_energy/social/chill) is now the redundant one — its energy
-- contribution is superseded by the scale question, and its social/chill
-- weight is already covered by the other five active questions.
begin;

update personality_questions
set is_active = false
where prompt = 'You''re at a cafe with friends for 2 hours. Your natural mode is...';

-- Renumber the 5 remaining single_select questions to a gapless 1-5, and
-- move the scale question from its 0053 placeholder (11) to 6, so the quiz
-- reads as a clean 6-step flow instead of jumping 5 -> 11.
update personality_questions set display_order = 2
  where prompt = 'You''re playing casual sports with new people. Your energy is...';
update personality_questions set display_order = 3
  where prompt = 'Friday night plan with friends. Plans change unexpectedly at the last minute. You...';
update personality_questions set display_order = 4
  where prompt = 'Thinking about how much you want to socialize from week to week...';
update personality_questions set display_order = 5
  where prompt = 'After a hangout where you met someone new and thought "I''d definitely hang with them again," it''s usually because...';
update personality_questions set display_order = 6
  where question_type = 'scale';

commit;
