-- ============================================
-- 0006_add_convenience_fee.sql
-- Add configurable convenience fee per activity
-- ============================================

alter table activity_types add column convenience_fee int default 9;

-- Set ₹9 for all existing activities
update activity_types set convenience_fee = 9 where convenience_fee is null;
