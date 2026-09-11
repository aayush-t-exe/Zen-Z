-- Trims the personality quiz from 10 questions to 6.
--
-- Deactivated rather than deleted: personality_answers rows from students
-- who already took the 10-question quiz reference these question/option ids
-- by FK, and is_active/display_order is exactly what personality-quiz.tsx
-- already filters and orders on (no app code involved).
--
-- Cut, with rationale:
--   - "You're 30 minutes into a group dinner..." (dim_chill/social/deep/curious)
--     — overlaps Q1/Q6/Q10 on the same traits.
--   - "A group is picking a restaurant for dinner..." (dim_adventurous/chill)
--     — overlaps Q5/Q6/Q8 on the same traits.
--   - "You just spent 2+ hours hanging out..." (dim_energy/chill)
--     — overlaps Q4/Q8 on energy.
--   - "For a hangout ... your ideal group size is..." — unscored (no
--     personality_option_weights rows), and not read anywhere outside the
--     quiz itself (apps/admin's group-size fields are the activity's
--     configured min/max, not this per-student preference).
--
-- Kept: Q1 (group role), Q4 (cafe hangout mode), Q5 (sports energy — the
-- only question in the whole bank that scores dim_competitive at all, so it
-- can't be cut without losing that trait entirely), Q6 (plans change), Q8
-- (social consistency), Q10 (why hang again). Between them every scored
-- dimension keeps at least 2 questions except dim_competitive, which was
-- already a single-question dimension before this trim.
begin;

update personality_questions
set is_active = false
where prompt in (
  'You''re 30 minutes into a group dinner. The conversation is...',
  'A group is picking a restaurant for dinner. Where do you lean?',
  'You just spent 2+ hours hanging out with a group (movie, dinner, cafe). As you''re leaving...',
  'For a hangout (movie, dinner, cafe session), your ideal group size is...'
);

-- Renumber the survivors to a gapless 1-6 so the progress bar (which just
-- divides by questions.length) and step order stay contiguous.
update personality_questions set display_order = 1
  where prompt = 'You''re hanging out with 4-5 people. Without overthinking, what''s usually true about you?';
update personality_questions set display_order = 2
  where prompt = 'You''re at a cafe with friends for 2 hours. Your natural mode is...';
update personality_questions set display_order = 3
  where prompt = 'You''re playing casual sports with new people. Your energy is...';
update personality_questions set display_order = 4
  where prompt = 'Friday night plan with friends. Plans change unexpectedly at the last minute. You...';
update personality_questions set display_order = 5
  where prompt = 'Thinking about how much you want to socialize from week to week...';
update personality_questions set display_order = 6
  where prompt = 'After a hangout where you met someone new and thought "I''d definitely hang with them again," it''s usually because...';

commit;
