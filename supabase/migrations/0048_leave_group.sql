-- ============================================
-- 0048_leave_group.sql
--
-- Lets a student leave a group once its meet has happened. "Leave" is a
-- personal archive, not a shared-data action: it only touches the calling
-- student's own group_members row, so it never affects the other
-- members' view of the group or its chat history. Concretely:
--   - my_group_details stops surfacing the group for that student.
--   - the message RLS policies stop letting that student read/send in
--     that group's chat.
--   - everyone else's access, and the group's own row, are untouched.
--
-- Deleting a group entirely is already covered by the pre-existing
-- "admin manage groups" policy (0001_init.sql) — the founder can delete
-- a `groups` row outright from the admin dashboard, which cascades to
-- group_members and messages (both `on delete cascade`) but is blocked
-- by the `reports.group_id` FK (no cascade there) if a report was ever
-- filed against that group. No schema change needed for that half of
-- the ask.
--
-- Same "trigger pins the mutable surface, policy only gates who" shape
-- as 0047_delete_own_messages.sql: the only update a student can make to
-- their own group_members row is "leave," so the trigger forces every
-- other column to its old value and requires the event to be over.
-- ============================================

alter table group_members add column left_at timestamptz;

create or replace function enforce_group_member_leave_only()
returns trigger
language plpgsql
as $$
declare
  event_time timestamptz;
begin
  if old.left_at is not null then
    raise exception 'already left this group';
  end if;

  select s.slot_datetime into event_time
  from groups g join slots s on s.id = g.slot_id
  where g.id = old.group_id;

  if event_time is null or now() < event_time then
    raise exception 'cannot leave a group before the meet has happened';
  end if;

  new.group_id := old.group_id;
  new.booking_id := old.booking_id;
  new.left_at := now();

  return new;
end;
$$;

create trigger group_members_enforce_leave_only
before update on group_members
for each row execute function enforce_group_member_leave_only();

create policy "member can leave own group" on group_members
  for update using (
    exists (select 1 from bookings b where b.id = group_members.booking_id and b.user_id = auth.uid())
  );

-- ---- exclude a left member from their own view of the group + chat ----

drop view if exists my_group_details;

create view my_group_details as
select
  b.id as booking_id,
  g.id as group_id,
  s.slot_datetime,
  s.reveal_venue_at,
  (now() >= s.reveal_venue_at) as is_revealed,
  a.name as activity_name,
  a.emoji as activity_emoji,
  case when now() >= s.reveal_venue_at then v.name else null end as venue_name,
  case when now() >= s.reveal_venue_at then v.address else null end as venue_address
from bookings b
join group_members gm on gm.booking_id = b.id
join groups g on g.id = gm.group_id
join slots s on s.id = g.slot_id
join activity_types a on a.id = s.activity_type_id
left join venues v on v.id = g.venue_id
where b.user_id = auth.uid() and g.status = 'confirmed' and gm.left_at is null;

alter view my_group_details set (security_invoker = true);

drop policy "group members read messages after reveal" on messages;
drop policy "group members send messages after reveal" on messages;

create policy "group members read messages after reveal" on messages
  for select using (
    exists (
      select 1 from group_members gm join bookings b on b.id = gm.booking_id
      where gm.group_id = messages.group_id and b.user_id = auth.uid() and gm.left_at is null
    )
    and exists (
      select 1 from groups g join slots s on s.id = g.slot_id
      where g.id = messages.group_id and now() >= s.reveal_venue_at
    )
  );

create policy "group members send messages after reveal" on messages
  for insert with check (
    auth.uid() = sender_id and exists (
      select 1 from group_members gm join bookings b on b.id = gm.booking_id
      where gm.group_id = messages.group_id and b.user_id = auth.uid() and gm.left_at is null
    )
    and exists (
      select 1 from groups g join slots s on s.id = g.slot_id
      where g.id = messages.group_id and now() >= s.reveal_venue_at
    )
  );
