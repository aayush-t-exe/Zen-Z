-- ============================================
-- 0015_add_men_only_and_update_fee.sql
--
-- Adds "men_only" as a third group_preference option alongside
-- mixed/women_only (the mobile booking flow now offers it), and raises
-- the convenience fee from ₹9 to ₹21 across all activities.
-- ============================================

alter table bookings drop constraint bookings_group_preference_check;
alter table bookings add constraint bookings_group_preference_check
  check (group_preference in ('mixed', 'women_only', 'men_only'));

alter table activity_types alter column convenience_fee set default 21;
update activity_types set convenience_fee = 21;
