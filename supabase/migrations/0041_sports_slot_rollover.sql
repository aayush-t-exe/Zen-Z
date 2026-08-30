-- ============================================
-- 0041_sports_slot_rollover.sql
--
-- Reverses the "Sports is a one-off trial, never auto-reseed" call from
-- 0032/PRODUCT_SPEC.md §1.5a (founder decision, 2026-08-25): Sports should
-- roll over new slots the same way Cafés/Dinners/Movies do. All four games
-- share one weekly slot — Saturday 6:00 PM IST (see 0032) — so this just
-- adds four more ensure_next_slot() calls to the existing rollover job from
-- 0039, rather than building a separate mechanism.
-- ============================================

create or replace function run_slot_rollover()
returns void
language plpgsql
as $$
begin
  perform ensure_next_slot('Cafés', 0, 17, 0);        -- Sunday 5:00 PM IST
  perform ensure_next_slot('Dinners', 6, 19, 0);      -- Saturday 7:00 PM IST
  perform ensure_next_slot('Movies', 2, 20, 0);       -- Tuesday 8:00 PM IST
  perform ensure_next_slot('Box Cricket', 6, 18, 0);  -- Saturday 6:00 PM IST
  perform ensure_next_slot('Football', 6, 18, 0);     -- Saturday 6:00 PM IST
  perform ensure_next_slot('8-Ball Pool', 6, 18, 0);  -- Saturday 6:00 PM IST
  perform ensure_next_slot('Pickleball', 6, 18, 0);   -- Saturday 6:00 PM IST
end;
$$;
