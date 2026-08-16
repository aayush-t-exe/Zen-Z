-- ============================================
-- 0030_replace_activity_emoji_with_icon_key.sql
-- Emoji are banned from the product's UI. `activity_types.emoji` held
-- literal emoji characters ('☕', '🍽', '🎬') and was rendered directly by
-- six mobile screens and four admin pages, so the ban could not be
-- honoured while the column still existed in that shape.
--
-- Renaming it to `icon_key` and constraining it to a lowercase slug makes
-- the rule structural rather than a habit: there is no longer a field an
-- emoji can legally be stored in. Same "enforce it at the data layer, not
-- just in the UI" principle the photo-privacy views follow.
--
-- The client maps the slug to a drawn glyph, so adding a fourth activity
-- stays a data change (insert a row with icon_key = 'picnic') plus one
-- glyph in the mobile icon module.
--
-- my_group_details is dropped and recreated because its output column
-- `activity_emoji` is part of the mobile app's contract and is renamed to
-- `activity_icon_key`; a column rename alone would leave the stale alias.
-- ============================================

drop view if exists my_group_details;

alter table activity_types rename column emoji to icon_key;

update activity_types
set icon_key = case
  when name ilike 'caf%'    then 'cafe'
  when name ilike 'dinner%' then 'dinner'
  when name ilike 'movie%'  then 'movie'
  else lower(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g'))
end;

alter table activity_types
  alter column icon_key set not null;

-- An emoji cannot satisfy this pattern, which is the point.
alter table activity_types
  add constraint activity_types_icon_key_is_slug
  check (icon_key ~ '^[a-z][a-z0-9_]*$');

-- Recreated verbatim from 0018 apart from the icon_key column.
create view my_group_details as
select
  b.id as booking_id,
  g.id as group_id,
  s.slot_datetime,
  s.reveal_venue_at,
  (now() >= s.reveal_venue_at) as is_revealed,
  a.name as activity_name,
  a.icon_key as activity_icon_key,
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
