-- ============================================
-- 0012_dedupe_activity_types.sql
--
-- activity_types has had duplicate rows since 0001_init.sql seeded
-- ('Cafes','Dinners','Movies') (ids 1-3) and 0005_seed_slots.sql
-- separately seeded ('Café','Dinner','Movie') (ids 7-9) — different
-- strings, and activity_types.name has no unique constraint, so
-- 0005's `on conflict do nothing` never had anything to conflict on.
-- Every real slot (and now the Tuesday movie slots from 0011) was
-- created against the second set (7-9); the first set (1-3) has zero
-- slots and zero venues referencing it — confirmed before writing this
-- migration. The mobile app's home screen independently hardcoded
-- activity ids 1/2/3, which is why booking any activity showed
-- "No available slots at the moment": it was always querying the dead
-- duplicate rows, not the ones with real data. Deleting the duplicates
-- here; the mobile app is being changed separately to fetch
-- activity_types from the database instead of hardcoding ids.
-- ============================================

delete from activity_types where id in (1, 2, 3);
