-- ============================================
-- 0044_midnight_ist_booking_cutoff.sql
--
-- 0043 closed bookings at a flat 48h-before-event mark, which is exact but
-- lands at a different odd clock time per activity (Sun 8PM for Movies,
-- Fri 5PM for Cafés, ...) — not something a student can easily reason
-- about or a founder can put in copy.
--
-- Founder decision (2026-08-25): switch to a calendar rule instead — a
-- slot stops being bookable at midnight IST, 2 days before its date
-- ("book by end of day, 2 days ahead"), the same rule for every activity.
-- Equivalent to: only bookable if the slot's IST calendar date is at
-- least 3 days out from today's IST calendar date.
--
-- Still safe against the bug 0043 fixed: since every activity's slot time
-- is some PM hour (17:00-20:00 IST) and this cutoff always lands at
-- 00:00 IST on the same calendar day reveal_venue_at (event - 48h) falls
-- on, the cutoff always precedes that slot's reveal by that many hours
-- (17-20h) — comfortably before, for every activity, every time.
-- ============================================

drop policy "own bookings insert" on bookings;
create policy "own bookings insert" on bookings
  for insert with check (
    auth.uid() = user_id
    and not exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.booking_blocked_until is not null
        and p.booking_blocked_until > now()
    )
    and exists (
      select 1 from slots s
      where s.id = slot_id
        and s.slot_datetime >= (
          date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '3 days'
        ) at time zone 'Asia/Kolkata'
    )
  );
