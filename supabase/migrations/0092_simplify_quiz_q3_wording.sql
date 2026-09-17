-- Simplifies Q3's ("Which of these do you actually agree with?") option
-- wording, founder request (2026-09-15): the original phrasing ("is
-- basically a tax you pay", "even if it stings a little") read more
-- literary than conversational. Plain, everyday phrasing, same opinions.
-- Cosmetic only — see 0091 for why this is safe against
-- personality_option_weights (keyed on option id, not label text).
begin;

update personality_question_options
set label = 'I''d rather skip small talk and get to the real conversation'
where label = 'Small talk is basically a tax you pay before the real conversation starts';

update personality_question_options
set label = 'Last-minute plan changes don''t really bother me'
where label = 'If plans fall through last minute, it''s not that deep';

update personality_question_options
set label = 'It''s fine to stop replying to someone you don''t click with'
where label = 'It''s okay to ghost someone you clearly don''t vibe with';

update personality_question_options
set label = 'Hangouts are more fun with no fixed plan'
where label = 'Group hangouts are better with no fixed plan';

update personality_question_options
set label = 'I''d rather be honest than comfortable, even if it stings a bit'
where label = 'Honesty over comfort, even if it stings a little';

update personality_question_options
set label = 'It''s normal to overthink a text before sending it'
where label = 'Overthinking every text before sending is completely normal';

commit;
