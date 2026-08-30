-- ============================================
-- 0061_activity_profit_amount.sql
-- Analytics' "Total revenue" KPI sums convenience_fee, which is what the
-- student is charged, not what the founder actually nets — convenience_fee
-- for sports bakes in real venue/equipment costs that vary per activity, so
-- revenue and profit diverge a lot (e.g. Movies charges ₹126 but nets ₹26).
-- Founder-supplied flat profit-per-booking figures per activity, 2026-08-27.
-- ============================================

alter table activity_types add column profit_amount numeric not null default 0;

update activity_types set profit_amount = 21 where name = 'Cafés';
update activity_types set profit_amount = 21 where name = 'Dinners';
update activity_types set profit_amount = 26 where name = 'Movies';
update activity_types set profit_amount = 21 where name = 'Box Cricket';
update activity_types set profit_amount = 21 where name = 'Football';
update activity_types set profit_amount = 32.5 where name = '8-Ball Pool';
update activity_types set profit_amount = 29 where name = 'Pickleball';
