-- ============================================
-- 0079_venue_reveal_maps_message.sql
--
-- The venue reveal (0018) exposes venue_name/venue_address as plain text
-- once reveal_venue_at passes, but never gave the group an actual map to
-- the place — students had to copy the address into Maps by hand. This
-- makes the group chat auto-post a system message with a ready-to-tap
-- Google Maps link the instant the same reveal boundary that unlocks
-- chat itself passes, using the is_system column that's existed since
-- 0001_init.sql but has never actually been set by any code path (0055
-- only ever locked *client* spoofing of it down — this is its first
-- legitimate use, via a security definer function same as every other
-- system-initiated write in this file).
--
-- No Places/Geocoding API involved — venues only ever have a free-text
-- name/address (0001_init.sql: no lat/lng or place_id column), so this
-- builds a plain Maps *search* deep link (`/maps/search/?api=1&query=`),
-- which needs no API key and just opens Maps pre-searched for that text.
-- Good enough for named local venues; a precise dropped pin would need a
-- lat/lng or place_id column added to venues, which none of the
-- founder's venues have data for yet — not added here.
--
-- [ASSUMPTION] The chat-message copy below ("The mystery unlocks...")
-- reuses the venue_reveal push notification's already-established copy
-- verbatim for the opening line, then appends the venue itself — not
-- separately founder-reviewed as chat copy, same caveat already flagged
-- for 0066/0070/0071's own new system-message copy.
-- ============================================

-- Small self-contained percent-encoder — Postgres has no builtin one.
-- Needed to safely embed the venue name/address (arbitrary founder-
-- entered free text) into a URL query string.
create or replace function url_encode(input text)
returns text
language plpgsql
immutable
as $$
declare
  result text := '';
  bytes bytea := convert_to(input, 'UTF8');
  b int;
  i int;
begin
  for i in 0 .. length(bytes) - 1 loop
    b := get_byte(bytes, i);
    if (b between 48 and 57) or (b between 65 and 90) or (b between 97 and 122)
       or b = 45 or b = 46 or b = 95 or b = 126 then
      result := result || chr(b);
    else
      result := result || '%' || upper(to_hex(b));
    end if;
  end loop;
  return result;
end;
$$;

-- Structured payload alongside system messages, mirroring
-- notifications_outbox.data — lets the client render a real tappable
-- "Open in Google Maps" affordance instead of regex-parsing a URL back
-- out of freeform message text.
alter table messages add column data jsonb not null default '{}'::jsonb;

-- Idempotency marker per group. notifications_outbox uses a
-- (type, user_id, reference_id) unique constraint for this because it
-- enqueues one row per recipient; this is one message shared by the
-- whole group, so a per-group "already posted" timestamp is the simpler
-- fit — claimed atomically via the UPDATE ... RETURNING below so two
-- overlapping cron ticks can't both post it.
alter table groups add column venue_message_sent_at timestamptz;

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
  -- Postgres doesn't allow the target table (g) to be referenced inside a
  -- nested JOIN's ON clause within an UPDATE ... FROM — only at the FROM
  -- list's top level — so venues is joined via a second FROM item plus a
  -- WHERE condition instead of `join venues v on v.id = g.venue_id`.
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
    returning g.id as group_id, v.name as venue_name, v.address as venue_address
  loop
    v_location := r.venue_name || coalesce(', ' || r.venue_address, '');
    v_maps_url := 'https://www.google.com/maps/search/?api=1&query=' || url_encode(v_location);

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

-- Separate named job on the same per-minute cadence as notification-cycle
-- (0019) and slot-rollover (0039), rather than folding this into
-- notification-cycle's own command string — keeps this migration from
-- having to reproduce/re-schedule that job's existing vault-secret-based
-- net.http_post call.
create extension if not exists pg_cron;

select cron.schedule(
  'venue-reveal-messages',
  '* * * * *',
  $$select post_venue_reveal_messages();$$
);
