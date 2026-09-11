-- profile-creation.tsx only found out a referral code was wrong at final
-- submit (the profiles_referred_by_code_fkey error), well after the student
-- had already stepped through DOB/year/gender/phone/photo. RLS on
-- `referrals` ("self read own referral") only lets a client see their own
-- code, not look up someone else's to check it exists — the whole point of
-- a referral code — so a security definer function is the only way to let
-- the app validate one immediately, on the step it's actually entered.
create or replace function validate_referral_code(p_code text) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from referrals
    where code = upper(trim(p_code))
      and owner_id is distinct from auth.uid()
  );
end;
$$;

grant execute on function validate_referral_code(text) to authenticated;
