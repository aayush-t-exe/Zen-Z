-- ============================================
-- 0096_support_contact_settings.sql
-- Contact Support in the payment "stuck" state and the profile Help menu
-- (founder request, 2026-09-16, after a real payment got stuck unpaid with
-- no way for the student to reach anyone). Same app_settings table 0034
-- introduced for the emergency contact number — distinct keys because
-- "someone needs help right now at a meetup" and "my payment isn't
-- fetching" are different concerns the founder may want to point at
-- different channels/numbers later, even though they share a value today.
-- support_whatsapp_phone is opened as a wa.me chat link (not tel:), since
-- profiles.phone is already established in this codebase as the WhatsApp
-- contact channel, not a calling one.
-- ============================================

insert into app_settings (key, value) values
  ('support_whatsapp_phone', '+917069183086'),
  ('support_email', 'teamzenz003@gmail.com');
