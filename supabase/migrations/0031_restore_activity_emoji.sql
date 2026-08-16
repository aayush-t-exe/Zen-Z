-- ============================================
-- 0031_restore_activity_emoji.sql
-- Reverses 0030 at the founder's request: the visual-system work and the
-- emoji removal are being rolled back, and the application code has been
-- restored to its pre-0030 shape, which reads `activity_types.emoji` and
-- `my_group_details.activity_emoji`.
--
-- Written as a forward migration rather than by deleting 0030, because
-- migrations are an applied ledger. 0030 already ran against the linked
-- project, so un-recording it would leave the file history and the actual
-- schema disagreeing.
--
-- Note for later: this deliberately puts emoji characters back into the
-- database, which contradicts the "no emoji anywhere" rule. That rule is
-- being set aside as part of the rollback, not forgotten. Re-applying it
-- means re-doing 0030.
-- ============================================

drop view if exists my_group_details;

alter table activity_types
  drop constraint if exists activity_types_icon_key_is_slug;

alter table activity_types rename column icon_key to emoji;

alter table activity_types
  alter column emoji drop not null;

update activity_types
set emoji = case
  when name ilike 'caf%'    then '☕'
  when name ilike 'dinner%' then '🍽'
  when name ilike 'movie%'  then '🎬'
  else null
end;

-- Restored verbatim from 0018_group_reveal_and_chat.sql.
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
