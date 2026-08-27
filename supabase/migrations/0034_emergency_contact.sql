-- ============================================
-- 0034_emergency_contact.sql
-- Emergency help button: a persistent in-app control that opens the
-- native dialer pre-filled with the founder's number, for a student who
-- needs help during a meetup. Neither iOS nor Android lets an app place
-- a call without the user tapping to confirm, so this seeds the number
-- the mobile client dials out to rather than the call itself.
--
-- Generic key/value settings table (not a dedicated emergency_contacts
-- table) since there's exactly one value today and no reason to predict
-- a second yet. The founder updates the value via a data edit in the
-- Supabase table editor when the number changes — that's a data change,
-- not the schema change CLAUDE.md's migration-only rule is about.
-- ============================================

create table app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

-- Any signed-in student can read settings (there's nothing sensitive in
-- here — just the emergency number). Only the service role can write,
-- so there is deliberately no insert/update/delete policy for students.
create policy "authenticated users read app settings" on app_settings
  for select using (auth.uid() is not null);

insert into app_settings (key, value) values
  ('emergency_contact_phone', '+917069183086');
