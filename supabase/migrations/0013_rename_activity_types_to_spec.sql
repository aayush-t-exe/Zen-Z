-- ============================================
-- 0013_rename_activity_types_to_spec.sql
--
-- The activity_types rows that survived 0012's dedupe (ids 7-9, the
-- ones with real slots) are named singular ('Café'/'Dinner'/'Movie').
-- docs/PRODUCT_SPEC.md's home screen mockup uses plural
-- ('Cafés'/'Dinners'/'Movies') — ironically the naming of the empty
-- duplicate rows 0012 just deleted. Renaming in place (same ids, so no
-- FK impact on slots/venues) to match the spec.
-- ============================================

update activity_types set name = 'Cafés' where name = 'Café';
update activity_types set name = 'Dinners' where name = 'Dinner';
update activity_types set name = 'Movies' where name = 'Movie';
