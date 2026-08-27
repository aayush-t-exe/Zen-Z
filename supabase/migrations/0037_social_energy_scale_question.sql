-- Reframes the single scale question as Timeleft's "social energy" question
-- (Introverted / Ambiverted / Extroverted), matching its exact copy per
-- founder request. Repoints the scale mapping from "adventurous" to
-- "social" since that's the dimension this question now actually measures.
update personality_questions
  set prompt = 'What''s your social energy like?'
  where id = 5 and question_type = 'scale';

update personality_scale_mappings
  set dimension_id = (select id from personality_dimensions where key = 'social')
  where question_id = 5 and dimension_id = (select id from personality_dimensions where key = 'adventurous');

-- Per-question, per-tier copy for scale questions — lets a scale question
-- show specific labels/descriptions (like Timeleft's Introverted/Ambiverted/
-- Extroverted) instead of the generic "Low/Balanced/High on {dimension}"
-- fallback. Optional: a scale question with no rows here just falls back to
-- the generic phrasing in the app, so this stays a data-only addition for
-- future scale questions too.
create table personality_scale_labels (
  question_id int references personality_questions(id) on delete cascade,
  tier smallint not null check (tier in (0, 1, 2)),
  label text not null,
  description text not null,
  primary key (question_id, tier)
);

alter table personality_scale_labels enable row level security;

create policy "anyone read personality scale labels" on personality_scale_labels
  for select using (true);

create policy "admin manage personality scale labels" on personality_scale_labels
  for all using (auth.uid() in (select id from admin_users));

insert into personality_scale_labels (question_id, tier, label, description) values
  (5, 0, 'Introverted', 'I prefer smaller groups or one-on-one conversations.'),
  (5, 1, 'Ambiverted', 'I enjoy both, it depends on the moment.'),
  (5, 2, 'Extroverted', 'I love being around people, it gives me energy.');
