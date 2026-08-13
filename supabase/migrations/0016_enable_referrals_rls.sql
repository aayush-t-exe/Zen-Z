-- ============================================
-- 0016_enable_referrals_rls.sql
--
-- referrals has had RLS disabled since 0001_init.sql — missed by 0007's
-- cleanup of the other ungated tables. Anyone with the anon/authenticated
-- key can currently read every user's referral relationships and write
-- arbitrary owner_id/used_by/used_at values.
--
-- No application code anywhere references this table yet (grepped both
-- apps — nothing) — it's unused schema for a referral feature that
-- hasn't been built. Rather than guess at a redemption flow that
-- doesn't exist, this locks it down to what's unambiguously safe: a
-- user can see/create their own referral row, admins can manage
-- everything. Whoever builds the actual "redeem someone else's code"
-- flow should design that specific access path deliberately (most
-- likely a security-definer function that validates and redeems
-- atomically), not inherit a broad policy guessed at ahead of time.
-- ============================================

alter table referrals enable row level security;

create policy "self read own referral" on referrals
  for select using (auth.uid() = owner_id);

create policy "self create own referral" on referrals
  for insert with check (auth.uid() = owner_id);

create policy "admin manage referrals" on referrals
  for all using (auth.uid() in (select id from admin_users));
