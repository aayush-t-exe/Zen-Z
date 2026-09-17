-- Shortens Q1's ("Which of these are genuinely "your thing"?") option
-- labels, founder request (2026-09-15): the full-sentence options made the
-- multi-select chip grid overflow past one screen. Cut to short tags that
-- keep the same flavor/meaning, so the grid fits without scrolling. Purely
-- cosmetic — scoring keys off personality_question_options.id via
-- personality_option_weights, not label text, so this touches no FK'd data.
begin;

update personality_question_options
set label = 'Stand-up & comedy'
where label = 'Stand-up specials & comedy podcasts';

update personality_question_options
set label = 'Bollywood/action'
where label = 'Mass, masala, everyone''s-hyped Bollywood/action';

update personality_question_options
set label = 'Arthouse films'
where label = 'Slow-burn, arthouse, "wait for the third act" films';

update personality_question_options
set label = 'Cricket/football'
where label = 'Cricket/football — watching or playing';

update personality_question_options
set label = 'Gaming'
where label = 'Gaming (console, PC, or mobile)';

update personality_question_options
set label = 'Memes & reels'
where label = 'Meme pages, reels, "brainrot" internet humor';

update personality_question_options
set label = 'True crime & docs'
where label = 'True crime, documentaries, deep-dive YouTube';

update personality_question_options
set label = 'Live gigs & festivals'
where label = 'Live gigs, music festivals';

commit;
