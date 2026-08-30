-- ============================================
-- 0043_close_bookings_48h_before_event.sql
--
-- 0039 set the booking cutoff to 24h before slot_datetime, but
-- reveal_venue_at (0018) is fixed at 48h before slot_datetime — 48h is
-- earlier than 24h, so a student could still book inside that 24h-48h
-- window, after the reveal moment for that slot had already passed. If the
-- founder then matched them, the group's venue/chat unlocked all at once
-- the instant confirm_group() ran instead of via the intended slow reveal.
--
-- Founder decision (2026-08-25): close bookings at the same 48h mark
-- reveal already uses, so every group's slot is fully booked-out before
-- its reveal moment arrives, and the founder always has the full 48h
-- window to match + assign a venue before anything reveals.
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
        and s.slot_datetime > now() + interval '48 hours'
    )
  );
