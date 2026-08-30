-- The "own bookings insert" RLS policy (0044_midnight_ist_booking_cutoff.sql)
-- checks ownership, no-show blocks, and the booking cutoff, but never
-- checked for an existing active booking on the same slot — nothing
-- stopped a double-tap or a resubmit-after-navigating-back from creating
-- two live rows for the same student+slot. Scoped to non-cancelled status
-- so a student can still rebook the same slot after cancelling.
create unique index bookings_user_slot_active_unique
  on bookings (user_id, slot_id)
  where status != 'cancelled';
