-- ============================================
-- 0019_notifications.sql
-- Milestone 16 (Notifications). Copy is verbatim from
-- docs/PRODUCT_SPEC.md §1.10. Delivery is Expo Push (§3.7), fanned out by
-- one Edge Function (send-notifications) that flushes a queue table —
-- notifications_outbox — populated two ways:
--   1. Instant triggers for event-driven notifications (booking made,
--      group matched, no-show recorded).
--   2. A periodic scan (enqueue_scheduled_notifications, called every
--      minute by pg_cron) for time-based ones (venue reveal, 2h-before
--      reminder, post-event feedback prompt) where nothing else fires an
--      event at the right moment.
-- The (type, user_id, reference_id) unique constraint is what makes the
-- periodic scan idempotent — it re-evaluates the same "is this now true"
-- condition every run, and relies on the constraint (not a time window)
-- to guarantee each notification is enqueued exactly once.
-- ============================================

alter table profiles add column push_token text;
-- Covered by the existing "self update profile" policy (auth.uid() = id)
-- from 0001_init.sql — no new RLS policy needed for this column.

create table notifications_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null check (type in (
    'booking_confirmed', 'group_matched', 'venue_reveal',
    'event_reminder_2h', 'post_event_feedback', 'no_show'
  )),
  reference_id uuid not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  error text,
  created_at timestamptz default now(),
  sent_at timestamptz,
  unique (type, user_id, reference_id)
);

alter table notifications_outbox enable row level security;
-- Internals of the sending mechanism, not user-facing data — no student
-- ever queries this table, so no policies for `authenticated`. The
-- service-role client used by send-notifications bypasses RLS as usual.
create policy "admin read notifications_outbox" on notifications_outbox
  for select using (auth.uid() in (select id from admin_users));

-- ============================================
-- Instant enqueues
-- ============================================

create or replace function enqueue_booking_confirmed()
returns trigger
language plpgsql
security definer
as $$
declare
  v_title text;
  v_body text;
begin
  select 'Your invitation is sealed.',
         a.name || ', ' || to_char(s.slot_datetime at time zone 'Asia/Kolkata', 'Dy HH12:MI AM')
  into v_title, v_body
  from slots s join activity_types a on a.id = s.activity_type_id
  where s.id = new.slot_id;

  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  values (new.user_id, 'booking_confirmed', new.id, v_title, v_body,
          jsonb_build_object('bookingId', new.id))
  on conflict (type, user_id, reference_id) do nothing;

  return new;
end;
$$;

create trigger on_booking_confirmed
  after insert on bookings
  for each row execute function enqueue_booking_confirmed();

-- Fires per group_members row rather than per groups row: confirm_group()
-- (0008/0017) inserts the groups row first and group_members rows second,
-- in the same transaction — an AFTER INSERT trigger on groups would run
-- before any group_members rows exist yet and would always find zero
-- members to notify.
create or replace function enqueue_group_matched()
returns trigger
language plpgsql
security definer
as $$
declare
  v_group_status text;
  v_user_id uuid;
begin
  select status into v_group_status from groups where id = new.group_id;
  if v_group_status <> 'confirmed' then
    return new;
  end if;

  select user_id into v_user_id from bookings where id = new.booking_id;

  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  values (
    v_user_id, 'group_matched', new.group_id,
    'The story begins here.',
    'Tap to meet your group.',
    jsonb_build_object('groupId', new.group_id)
  )
  on conflict (type, user_id, reference_id) do nothing;

  return new;
end;
$$;

create trigger on_group_member_added
  after insert on group_members
  for each row execute function enqueue_group_matched();

create or replace function enqueue_no_show()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  values (
    new.user_id, 'no_show', new.booking_id,
    'Your seat sat empty tonight.',
    'Here''s what that means next time.',
    jsonb_build_object('bookingId', new.booking_id)
  )
  on conflict (type, user_id, reference_id) do nothing;

  return new;
end;
$$;

create trigger on_no_show_recorded
  after insert on no_shows
  for each row execute function enqueue_no_show();

-- ============================================
-- Periodic (time-based) enqueue — called every minute by pg_cron
-- ============================================

create or replace function enqueue_scheduled_notifications()
returns void
language plpgsql
security definer
as $$
begin
  -- Venue reveal: the existing 48h reveal_venue_at boundary from 0018.
  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  select b.user_id, 'venue_reveal', g.id,
         'The mystery unlocks.',
         'Here''s where to be.',
         jsonb_build_object('groupId', g.id)
  from groups g
  join slots s on s.id = g.slot_id
  join group_members gm on gm.group_id = g.id
  join bookings b on b.id = gm.booking_id
  where g.status = 'confirmed' and now() >= s.reveal_venue_at
  on conflict (type, user_id, reference_id) do nothing;

  -- 2h-before-event reminder.
  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  select b.user_id, 'event_reminder_2h', b.id,
         'Two hours until your next adventure.',
         a.name || ' awaits.',
         jsonb_build_object('bookingId', b.id)
  from bookings b
  join slots s on s.id = b.slot_id
  join activity_types a on a.id = s.activity_type_id
  where b.status = 'matched' and s.slot_datetime - now() <= interval '2 hours'
  on conflict (type, user_id, reference_id) do nothing;

  -- Post-event feedback prompt, 3h after the slot started.
  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  select b.user_id, 'post_event_feedback', b.id,
         'How did your story end tonight?',
         'Tell us how it went.',
         jsonb_build_object('bookingId', b.id)
  from bookings b
  join slots s on s.id = b.slot_id
  where b.status = 'matched' and now() >= s.slot_datetime + interval '3 hours'
  on conflict (type, user_id, reference_id) do nothing;
end;
$$;

-- ============================================
-- Scheduling — pg_cron + pg_net, per the standard Supabase pattern.
-- The project URL and service-role key are NOT hardcoded here — they're
-- read from Vault at run time. Before this job can actually reach the
-- Edge Function, run once per environment (dev and prod), the same way
-- RAZORPAY_KEY_SECRET etc. are configured outside of migrations:
--   select vault.create_secret('<project-url>', 'project_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');
-- ============================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'notification-cycle',
  '* * * * *',
  $$
  select enqueue_scheduled_notifications();
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
