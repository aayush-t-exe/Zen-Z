-- Adds a real date-of-birth field to profiles. Distinct from year_of_study
-- (which tracks academic year, not age) — the profile-creation wizard now
-- collects both as separate steps.
alter table profiles add column date_of_birth date;
