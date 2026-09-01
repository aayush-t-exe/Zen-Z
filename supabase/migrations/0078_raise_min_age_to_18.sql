-- ============================================
-- 0078_raise_min_age_to_18.sql
--
-- Founder decision (2026-09-01): raise the minimum age from 16 to 18.
-- Zen-Z matches unverified strangers into small groups for real-world
-- meetups with no identity/background checks (a locked product rule —
-- see CLAUDE.md), so a 16-17 eligibility window was a real store-review
-- and safety risk with no verification lever available to offset it.
-- Replaces the 0050 constraint; still nullable (written after signup by
-- the profile-creation wizard), so the CHECK only constrains real values.
-- Confirmed zero existing profiles fall in the 16-17 gap before applying.
-- ============================================

alter table profiles drop constraint profiles_date_of_birth_min_age;

alter table profiles
  add constraint profiles_date_of_birth_min_age
  check (date_of_birth is null or date_of_birth <= (current_date - interval '18 years'));
