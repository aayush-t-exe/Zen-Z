-- ============================================
-- 0018_group_reveal_and_chat.sql
--
-- Wires up the two-stage reveal design already documented in
-- docs/PRODUCT_SPEC.md §1.8: group members are visible to a student the
-- moment confirm_group() confirms their group (already true today, via
-- the "members read groupmate public info" policy on profiles from
-- 0001_init.sql — untouched here), but venue and group chat stay locked
-- until a fixed 48h-before-the-event reveal window.
-- ============================================

-- slots.reveal_venue_at has existed since 0001_init.sql as a plain
-- nullable column, but nothing has ever set it. A generated column would
-- be the cleanest fix, but Postgres rejects timestamptz arithmetic in a
-- GENERATED ALWAYS AS ... STORED expression (not immutable — SQLSTATE
-- 42P17), so a trigger is the next-best self-maintaining approach:
-- every insert/update of slot_datetime keeps reveal_venue_at in sync
-- with no separate backfill step to remember on future migrations.
alter table slots drop column reveal_venue_at;
alter table slots add column reveal_venue_at timestamptz;

create or replace function set_slot_reveal_venue_at()
returns trigger
language plpgsql
as $$
begin
  new.reveal_venue_at := new.slot_datetime - interval '48 hours';
  return new;
end;
$$;

create trigger slots_set_reveal_venue_at
before insert or update of slot_datetime on slots
for each row execute function set_slot_reveal_venue_at();

-- One-time backfill for every slot that already existed before this
-- trigger did.
update slots set reveal_venue_at = slot_datetime - interval '48 hours';

-- ============================================
-- VIEW: my_group_details
-- ============================================
-- Student-facing view of their own confirmed group. Venue fields are
-- NULL until reveal_venue_at, computed here rather than trusted from the
-- client — same "enforced at the data layer, not just hidden in the UI"
-- principle as the photo-privacy views (group_member_public,
-- admin_student_profiles).
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
where b.user_id = auth.uid() and g.status = 'confirmed';

alter view my_group_details set (security_invoker = true);

-- ============================================
-- Time-gate group chat access
-- ============================================
-- The two message policies from 0001_init.sql only checked group
-- membership, with no time bound — a group's chat was technically
-- readable/writable from the moment confirm_group() ran. Chat itself
-- needs no separate "create" step (a thread is just messages scoped by
-- group_id, and that scope already exists once group_members rows are
-- inserted) — this policy change is what actually locks it until the
-- same reveal_venue_at boundary as the venue.
drop policy "group members read messages" on messages;
drop policy "group members send messages" on messages;

create policy "group members read messages after reveal" on messages
  for select using (
    exists (
      select 1 from group_members gm join bookings b on b.id = gm.booking_id
      where gm.group_id = messages.group_id and b.user_id = auth.uid()
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
      where gm.group_id = messages.group_id and b.user_id = auth.uid()
    )
    and exists (
      select 1 from groups g join slots s on s.id = g.slot_id
      where g.id = messages.group_id and now() >= s.reveal_venue_at
    )
  );

-- Enable Realtime so group chat updates live without a manual refresh.
alter publication supabase_realtime add table messages;
