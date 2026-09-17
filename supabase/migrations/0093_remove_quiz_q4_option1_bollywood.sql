-- Removes Q4's ("What's in your rotation?") option 1, "Bollywood/Hindi
-- pop", founder request (2026-09-15). Hard-deleted rather than deactivated
-- (see 0089/0091 for why that's normally avoided): zero personality_answers
-- rows reference this option's id, so there's no FK history to preserve.
-- Its dimension (music_bollywood_hindi) is deleted too for the same
-- reason — it was never scored for anyone.
begin;

delete from personality_option_weights
where option_id = (
  select id from personality_question_options
  where question_id = 19 and label = 'Bollywood/Hindi pop'
);

delete from personality_question_options
where question_id = 19 and label = 'Bollywood/Hindi pop';

delete from personality_dimensions
where key = 'music_bollywood_hindi';

-- Close the display_order gap left at position 1.
update personality_question_options set display_order = 1 where question_id = 19 and label = 'Punjabi/hip-hop';
update personality_question_options set display_order = 2 where question_id = 19 and label = 'English pop/Top 40';
update personality_question_options set display_order = 3 where question_id = 19 and label = 'Indie/alternative';
update personality_question_options set display_order = 4 where question_id = 19 and label = 'EDM/festival';
update personality_question_options set display_order = 5 where question_id = 19 and label = 'Hip-hop/rap';
update personality_question_options set display_order = 6 where question_id = 19 and label = 'Lo-fi/chill';
update personality_question_options set display_order = 7 where question_id = 19 and label = 'Rock/metal';
update personality_question_options set display_order = 8 where question_id = 19 and label = 'Devotional/classical Indian';

commit;
