-- ============================================
-- 0035_emergency_contact_backup.sql
-- A second emergency number, for when the founder (0034's
-- emergency_contact_phone) isn't reachable. Same app_settings table,
-- just another row — no schema change needed.
-- ============================================

insert into app_settings (key, value) values
  ('emergency_contact_phone_backup', '+919460623157');
