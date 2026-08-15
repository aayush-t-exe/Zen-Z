-- ============================================
-- 0024_enable_pgtap.sql
-- Milestone 19: Testing — enables pgTAP so supabase/tests/database/*.sql
-- can assert RLS/DB behavior directly against a linked project.
-- ============================================

create extension if not exists pgtap;
