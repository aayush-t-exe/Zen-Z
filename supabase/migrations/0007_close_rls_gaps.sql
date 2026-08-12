-- ============================================
-- 0007_close_rls_gaps.sql
--
-- admin_users, venues, activity_types, slots, and the personality
-- metadata tables (dimensions/questions/options/weights/scale mappings)
-- were never RLS-enabled since Milestone 3 — they're absent from the
-- "enable row level security" block in 0001_init.sql entirely, which
-- means anon/authenticated clients have unrestricted read AND write on
-- them, including admin_users (self-granting admin access is a real
-- privilege-escalation path). group_members has RLS on but was missing
-- an admin write policy, which blocks the matching board (Milestone 13
-- Phase 2) from ever inserting a confirmed group's members.
--
-- admin_users gets a *non-recursive* self-select policy (auth.uid() = id)
-- rather than the `auth.uid() in (select id from admin_users)` pattern
-- used elsewhere — a self-referencing subquery in admin_users' own
-- policy would hit the same RLS-recursion problem 0002 already had to
-- fix on profiles. Because RLS filters that subquery down to just the
-- caller's own row first, every existing
-- `auth.uid() in (select id from admin_users)` check on other tables
-- keeps working unchanged.
-- ============================================

alter table admin_users enable row level security;
create policy "self read own admin row" on admin_users
  for select using (auth.uid() = id);

alter table venues enable row level security;
create policy "admin manage venues" on venues
  for all using (auth.uid() in (select id from admin_users));

alter table activity_types enable row level security;
create policy "anyone read activity types" on activity_types
  for select using (true);
create policy "admin manage activity types" on activity_types
  for all using (auth.uid() in (select id from admin_users));

alter table slots enable row level security;
create policy "anyone read slots" on slots
  for select using (true);
create policy "admin manage slots" on slots
  for all using (auth.uid() in (select id from admin_users));

alter table personality_dimensions enable row level security;
create policy "anyone read personality dimensions" on personality_dimensions
  for select using (true);
create policy "admin manage personality dimensions" on personality_dimensions
  for all using (auth.uid() in (select id from admin_users));

alter table personality_questions enable row level security;
create policy "anyone read personality questions" on personality_questions
  for select using (true);
create policy "admin manage personality questions" on personality_questions
  for all using (auth.uid() in (select id from admin_users));

alter table personality_question_options enable row level security;
create policy "anyone read personality question options" on personality_question_options
  for select using (true);
create policy "admin manage personality question options" on personality_question_options
  for all using (auth.uid() in (select id from admin_users));

alter table personality_option_weights enable row level security;
create policy "anyone read personality option weights" on personality_option_weights
  for select using (true);
create policy "admin manage personality option weights" on personality_option_weights
  for all using (auth.uid() in (select id from admin_users));

alter table personality_scale_mappings enable row level security;
create policy "anyone read personality scale mappings" on personality_scale_mappings
  for select using (true);
create policy "admin manage personality scale mappings" on personality_scale_mappings
  for all using (auth.uid() in (select id from admin_users));

-- Missing admin write policy — group_members had RLS enabled with only
-- a member-read policy, so no one (not even the founder) could insert a
-- confirmed group's roster.
create policy "admin manage group_members" on group_members
  for all using (auth.uid() in (select id from admin_users));
