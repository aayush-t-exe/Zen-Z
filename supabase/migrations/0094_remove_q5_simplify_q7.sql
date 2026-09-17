-- Two founder-requested edits to the personality quiz (2026-09-15):
--
-- 1. Removes Q5 ("Your natural rhythm is...", id 20, the night-owl scale
--    question). Deactivated rather than deleted, matching 0082/0089's
--    convention for question-level removal (personality_answers rows would
--    reference it by FK) — though in this case there are zero answers on
--    it in dev either way. The three questions after it are renumbered
--    down one slot to close the display_order gap, same as 0082.
--
-- 2. Simplifies Q7's ("Which of these are true for you?") option wording
--    to plainer phrasing, same treatment as 0092's Q3 pass. Cosmetic only.
begin;

update personality_questions
set is_active = false
where id = 20;

update personality_questions set display_order = 5 where id = 21;
update personality_questions set display_order = 6 where id = 22;
update personality_questions set display_order = 7 where id = 5;

update personality_question_options
set label = 'I always go for North Indian food'
where label = 'North Indian comfort food, always';

update personality_question_options
set label = 'I always go for South Indian food'
where label = 'South Indian classics over anything else';

update personality_question_options
set label = 'I''d rather eat street food than sit down at a restaurant'
where label = 'Street food over a sit-down restaurant, any day';

update personality_question_options
set label = 'I always want to try a new cuisine'
where label = 'Always chasing a new/unfamiliar cuisine';

update personality_question_options
set label = 'The spicier the food, the better'
where label = 'Spice level: the hotter the better';

update personality_question_options
set label = 'The company matters more to me than the food'
where label = 'Honestly, it''s about the company — food''s secondary';

update personality_question_options
set label = 'I love hopping between desserts and cafes'
where label = 'Dessert/cafe-hopping is basically a personality trait';

commit;
