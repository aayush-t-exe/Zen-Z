-- Testing pass on the auth/profile-creation flow found two DB-level gaps:
-- the 16+ age gate and the year-of-study range were enforced only in the
-- mobile app's UI, so a direct API call could set either to anything.
-- Both columns stay nullable (existing rows and the profile-creation wizard
-- write them after signup), so CHECK allows null and only constrains real
-- values.
alter table profiles
  add constraint profiles_date_of_birth_min_age
  check (date_of_birth is null or date_of_birth <= (current_date - interval '16 years'));

alter table profiles
  add constraint profiles_date_of_birth_sane
  check (date_of_birth is null or date_of_birth > (current_date - interval '100 years'));

alter table profiles
  add constraint profiles_year_of_study_range
  check (year_of_study is null or year_of_study between 1 and 5);
