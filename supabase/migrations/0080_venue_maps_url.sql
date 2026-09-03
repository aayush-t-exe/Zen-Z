-- ============================================
-- 0080_venue_maps_url.sql
--
-- 0079 gave the group chat's system message a Google Maps link, but only
-- ever built it from venue name + free-text address — fine for a venue
-- Maps can resolve unambiguously from text alone, but the founder often
-- knows the exact Maps listing (a pin dropped in the app, a share link)
-- and has no way to hand that over. This adds an admin-editable
-- venues.maps_url so a founder-pasted link always wins, falling back to
-- the auto-generated search-query link (same construction as 0079) only
-- when the founder hasn't pasted one.
--
-- Also surfaces the same maps link on my_group_details.venue_maps_url,
-- gated by reveal_venue_at exactly like venue_name/venue_address already
-- are — this is what the booking-details screen's venue row uses to
-- become tappable, the same link the chat system message already sends.
-- ============================================

alter table venues add column maps_url text;

create or replace function post_venue_reveal_messages()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_location text;
  v_maps_url text;
begin
  for r in
    update groups g
    set venue_message_sent_at = now()
    from slots s, venues v
    where g.slot_id = s.id
      and g.venue_id = v.id
      and g.status = 'confirmed'
      and g.venue_id is not null
      and now() >= s.reveal_venue_at
      and g.venue_message_sent_at is null
    returning g.id as group_id, v.name as venue_name, v.address as venue_address, v.maps_url as venue_maps_url
  loop
    v_location := r.venue_name || coalesce(', ' || r.venue_address, '');
    v_maps_url := coalesce(
      nullif(r.venue_maps_url, ''),
      'https://www.google.com/maps/search/?api=1&query=' || url_encode(v_location)
    );

    insert into messages (group_id, sender_id, content, is_system, data)
    values (
      r.group_id,
      null,
      'The mystery unlocks. Here''s where to be: ' || v_location,
      true,
      jsonb_build_object('kind', 'venue_reveal', 'mapsUrl', v_maps_url)
    );
  end loop;
end;
$$;

-- Current shape is 0048's (added gm.left_at is null to exclude a student
-- who's since left the group) — this only adds the venue_maps_url column.
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
  case when now() >= s.reveal_venue_at then v.address else null end as venue_address,
  case when now() >= s.reveal_venue_at
    then coalesce(
      nullif(v.maps_url, ''),
      'https://www.google.com/maps/search/?api=1&query=' || url_encode(v.name || coalesce(', ' || v.address, ''))
    )
    else null
  end as venue_maps_url
from bookings b
join group_members gm on gm.booking_id = b.id
join groups g on g.id = gm.group_id
join slots s on s.id = g.slot_id
join activity_types a on a.id = s.activity_type_id
left join venues v on v.id = g.venue_id
where b.user_id = auth.uid() and g.status = 'confirmed' and gm.left_at is null;

alter view my_group_details set (security_invoker = true);
