-- ============================================
-- 0057_group_member_public_first_name_only.sql
-- Profile creation used to prompt for "your first name" and store whatever
-- was typed in profiles.full_name, so group_member_public (0022) exposing
-- the raw full_name column to groupmates happened to match the product
-- rule that groupmates only ever see a first name (docs/PRODUCT_SPEC.md
-- §1.10: "No photos shown — first name, year, and a blurb only").
--
-- The profile-creation screen now explicitly asks for a full name, so that
-- coincidence no longer holds — group_member_public must derive a first
-- name itself rather than pass full_name through, or groupmates would
-- start seeing each other's full names.
-- ============================================

drop view group_member_public;

create view group_member_public
with (security_invoker = false) as
select id, split_part(full_name, ' ', 1) as first_name, year_of_study
from profiles
where id in (select groupmate_user_ids());

revoke insert, update, delete, truncate, references, trigger
  on group_member_public from anon, authenticated;
grant select on group_member_public to anon, authenticated;
