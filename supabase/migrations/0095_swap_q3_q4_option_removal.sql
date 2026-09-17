-- Corrects a mix-up from 0093: the founder's "remove option 1" actually
-- meant Q3 ("Which of these do you actually agree with?"), not Q4 ("What's
-- in your rotation?"). Restores Q4's "Bollywood/Hindi pop" and instead
-- removes Q3's option 1, "I'd rather skip small talk and get to the real
-- conversation" (the smalltalk-tax opinion). Zero personality_answers rows
-- reference either option's id in dev, so both are safe to fully swap
-- rather than juggle deactivation.
begin;

-- ---------- restore Q4 option 1 ----------

update personality_question_options
set display_order = display_order + 1
where question_id = 19;

do $$
declare
  v_o int;
begin
  insert into personality_dimensions (key, label)
  values ('music_bollywood_hindi', 'Into Bollywood/Hindi pop');

  insert into personality_question_options (question_id, label, display_order)
  values (19, 'Bollywood/Hindi pop', 1)
  returning id into v_o;

  insert into personality_option_weights (option_id, dimension_id, weight)
  values (v_o, (select id from personality_dimensions where key = 'music_bollywood_hindi'), 1.0);
end $$;

-- ---------- remove Q3 option 1 ----------

delete from personality_option_weights
where option_id = (
  select id from personality_question_options
  where question_id = 18 and label = 'I''d rather skip small talk and get to the real conversation'
);

delete from personality_question_options
where question_id = 18 and label = 'I''d rather skip small talk and get to the real conversation';

delete from personality_dimensions
where key = 'opinion_smalltalk_tax';

update personality_question_options set display_order = 1 where question_id = 18 and label = 'Last-minute plan changes don''t really bother me';
update personality_question_options set display_order = 2 where question_id = 18 and label = 'It''s fine to stop replying to someone you don''t click with';
update personality_question_options set display_order = 3 where question_id = 18 and label = 'Hangouts are more fun with no fixed plan';
update personality_question_options set display_order = 4 where question_id = 18 and label = 'I''d rather be honest than comfortable, even if it stings a bit';
update personality_question_options set display_order = 5 where question_id = 18 and label = 'It''s normal to overthink a text before sending it';

commit;
