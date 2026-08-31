-- ============================================
-- 0066_new_message_notifications_and_unread_count.sql
--
-- Two gaps: no notification ever fired when a groupmate sent a chat
-- message (0019's notifications_outbox has no type for it, and nothing
-- ever inserted one), and no way to compute an unread count at all (no
-- per-member "read up to" marker existed anywhere).
--
-- [ASSUMPTION] The notification copy here (sender's first name as title,
-- the message text as body) is plain/functional rather than styled in the
-- mysterious-adventurous voice the rest of docs/PRODUCT_SPEC.md §1.10
-- uses — there's no existing microcopy for this trigger to match, and a
-- chat notification needs to be immediately legible (who, what) the way
-- WhatsApp/iMessage do, not cryptic. Treat as provisional pending founder
-- sign-off, same as the No-Show Policy microcopy already flagged this way.
-- ============================================

alter table notifications_outbox
  drop constraint notifications_outbox_type_check;
alter table notifications_outbox
  add constraint notifications_outbox_type_check
  check (type in (
    'booking_confirmed', 'group_matched', 'venue_reveal',
    'event_reminder_2h', 'post_event_feedback', 'no_show', 'new_message'
  ));

-- ---- read tracking ----
-- Defaults to now() so a freshly-added member starts at zero unread
-- (a brand-new group has no messages yet anyway) rather than every
-- pre-existing message in the group counting as unread the moment they
-- join — not a real scenario today (groups don't gain members after
-- confirm_group()), but the safe default regardless.
alter table group_members add column last_read_at timestamptz not null default now();

-- Dedicated RPC rather than opening a general UPDATE policy on
-- group_members for this column: the existing "member can leave own
-- group" policy's trigger (0048) unconditionally sets left_at = now() on
-- every update it allows, since it exists purely to implement "leave" —
-- reusing that path to also let a client bump last_read_at would silently
-- make every "mark as read" also leave the group. This bypasses that
-- entirely and only ever touches last_read_at.
create or replace function mark_group_read(p_group_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update group_members gm
  set last_read_at = now()
  from bookings b
  where gm.booking_id = b.id
    and gm.group_id = p_group_id
    and b.user_id = auth.uid()
    and gm.left_at is null;
end;
$$;

grant execute on function mark_group_read(uuid) to authenticated;

-- security invoker (the default) deliberately — it relies on the caller's
-- own RLS to correctly scope every table it touches: bookings' "own
-- bookings only" policy naturally limits the join to the caller's own
-- group_members row per group (so last_read_at is always read for the
-- right person), and messages' reveal-gated policy naturally excludes any
-- group that isn't revealed yet (nothing to count as unread there anyway).
create or replace function my_unread_message_count()
returns int
language sql
stable
as $$
  select count(*)::int
  from messages m
  join group_members gm on gm.group_id = m.group_id
  join bookings b on b.id = gm.booking_id
  where b.user_id = auth.uid()
    and gm.left_at is null
    and m.sender_id <> auth.uid()
    and m.is_system = false
    and m.deleted_at is null
    and m.created_at > gm.last_read_at
$$;

grant execute on function my_unread_message_count() to authenticated;

-- ---- notify every other group member on a new message ----
create or replace function enqueue_new_message()
returns trigger
language plpgsql
security definer
as $$
declare
  v_sender_name text;
begin
  if new.is_system then
    return new;
  end if;

  select split_part(full_name, ' ', 1) into v_sender_name
  from profiles where id = new.sender_id;

  insert into notifications_outbox (user_id, type, reference_id, title, body, data)
  select b.user_id, 'new_message', new.id,
         coalesce(v_sender_name, 'Someone'),
         left(new.content, 120),
         jsonb_build_object('groupId', new.group_id)
  from group_members gm
  join bookings b on b.id = gm.booking_id
  where gm.group_id = new.group_id
    and gm.left_at is null
    and b.user_id <> new.sender_id
  on conflict (type, user_id, reference_id) do nothing;

  return new;
end;
$$;

create trigger on_message_sent
  after insert on messages
  for each row execute function enqueue_new_message();
