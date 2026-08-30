-- ============================================
-- 0059_bookings_column_grants.sql
-- "own bookings insert" (0001_init.sql, extended by 0020/0044) only
-- restricts *which* row a student can create (auth.uid() = user_id, not
-- blocked, slot far enough out) — RLS has no concept of column
-- restriction, so a direct PostgREST insert with a valid session could set
-- payment_status/payment_id to anything, including 'paid', with no
-- Razorpay payment ever made. Verified live: an authenticated student
-- successfully self-inserted payment_status='paid', which would make that
-- booking eligible for confirm_group()'s matching pool for free.
--
-- 0029_cancel_unpaid_booking.sql already reasoned through this exact class
-- of problem for the UPDATE side ("a blanket self-update would also let a
-- student rewrite payment_status/status directly") and avoided it by never
-- granting students a self-update policy at all, routing cancellation
-- through a security definer RPC instead. This closes the matching gap on
-- INSERT with the same column-level GRANT pattern already used for
-- profiles (0051_profiles_column_grants.sql): restrict students to
-- exactly the columns booking-flow.tsx actually sends
-- (user_id, slot_id, budget_band, group_preference, status — status is
-- included only because the client currently sets it explicitly to its
-- own default value; nothing else may ever be inserted as anything other
-- than its column default). payment_status/payment_id are now only
-- writable via the service-role-only create-payment-order/razorpay-webhook
-- edge functions.
--
-- UPDATE stays revoked entirely except for `status`, which
-- confirm_group() (security invoker, admin-gated by RLS) needs to flip to
-- 'matched' when running as the calling admin's own role. Every other
-- student-facing status change (cancel, account deletion) already goes
-- through a security definer RPC, which bypasses grants entirely and so
-- needs none of this.
-- ============================================

revoke insert, update on bookings from authenticated;

grant insert (user_id, slot_id, budget_band, group_preference, status)
  on bookings to authenticated;

grant update (status)
  on bookings to authenticated;
