-- ============================================
-- 0049_message_level_reports.sql
--
-- Lets a student report one specific chat message, not just a groupmate
-- in general. Founder decision (2026-08-26, see docs/ARCHITECTURE.md
-- "Chat privacy"): the admin Reports queue still never renders message
-- content by default — that policy stands. This adds a narrow, logged
-- exception: the founder can explicitly reveal the one flagged message
-- tied to a report, and every reveal is recorded (who, when, which
-- report), rather than message content becoming a standing part of the
-- Reports queue UI.
-- ============================================

alter table reports add column message_id uuid references messages(id);

-- Audit trail for the logged-exception path. Deliberately admin-only —
-- students never see this, and it exists so "did the founder look at
-- this message, and when" is answerable later, matching the "deliberate,
-- logged exception" language in ARCHITECTURE.md rather than making
-- message content a routine, unaudited part of admin's view.
create table report_message_reveals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id),
  revealed_by uuid not null references admin_users(id),
  revealed_at timestamptz default now()
);

alter table report_message_reveals enable row level security;

create policy "admin read reveal log" on report_message_reveals
  for select using (auth.uid() in (select id from admin_users));

-- No insert policy: rows are only ever written by reveal_reported_message
-- below, which runs as security definer and bypasses RLS on this table
-- by design — inserting a reveal log row is not something either
-- students or admins should be able to do directly.

-- Only path that ever returns a flagged message's content to admin.
-- Every call is one logged reveal, even if the same report is opened
-- more than once — that's intentional, so the audit trail reflects how
-- many times the founder actually looked, not just whether they ever did.
create or replace function reveal_reported_message(p_report_id uuid)
returns table (content text, is_deleted boolean, sender_id uuid, created_at timestamptz)
language plpgsql
security definer
as $$
declare
  v_message_id uuid;
begin
  if not exists (select 1 from admin_users where id = auth.uid()) then
    raise exception 'Only admins can reveal a reported message';
  end if;

  select r.message_id into v_message_id from reports r where r.id = p_report_id;

  if v_message_id is null then
    raise exception 'This report is not tied to a specific message';
  end if;

  insert into report_message_reveals (report_id, revealed_by)
  values (p_report_id, auth.uid());

  return query
    select m.content, (m.deleted_at is not null), m.sender_id, m.created_at
    from messages m
    where m.id = v_message_id;
end;
$$;
