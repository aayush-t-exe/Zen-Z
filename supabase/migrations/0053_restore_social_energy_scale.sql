-- ============================================
-- 0053_restore_social_energy_scale.sql
-- 0052 deactivated every previously-active
-- question, including the intro/ambivert/extro
-- "social energy" scale question — that one was
-- supposed to stay. Reactivate it and place it
-- last in the new 10-question quiz.
--
-- Also repoints its scale mapping from "social"
-- to the new "energy" dimension: 0052 redefined
-- "social" to mean leading/energizing a group
-- (see Q1/Q2/Q10), while "energy" is exactly the
-- introvert/extrovert recharge axis this scale
-- question measures. Its on-screen copy and
-- Introverted/Ambiverted/Extroverted tier labels
-- (personality_scale_labels) are untouched.
-- ============================================

do $$
declare
  scale_q_id int;
  dim_energy int;
  dim_social int;
begin
  select id into dim_energy from personality_dimensions where key = 'energy';
  select id into dim_social from personality_dimensions where key = 'social';

  select id into scale_q_id from personality_questions where question_type = 'scale';

  update personality_questions
    set is_active = true, display_order = 11
    where id = scale_q_id;

  update personality_scale_mappings
    set dimension_id = dim_energy
    where question_id = scale_q_id and dimension_id = dim_social;
end $$;
