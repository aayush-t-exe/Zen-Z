import { supabase } from '@/lib/supabase';

export type PostAuthRoute = '/(auth)/profile-creation' | '/(auth)/personality-quiz' | '/(home)';

// A valid session isn't enough to land in (home) — a user can have a
// session but never have finished profile creation or the personality
// quiz (killed the app mid-onboarding, etc). Both the OTP-verification
// success path and app-boot session restore need this same decision, so
// it lives here once rather than drifting between two copies.
export async function getPostAuthRoute(userId: string): Promise<PostAuthRoute> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, gender, year_of_study')
    .eq('id', userId)
    .single();

  // handle_new_user() seeds full_name with the literal 'New user' sentinel
  // when signup doesn't supply one (always true for this app's OTP-only
  // signup), so a plain truthiness check here would treat every fresh
  // signup as having a real name.
  const profileComplete =
    !!profile?.full_name &&
    profile.full_name !== 'New user' &&
    !!profile?.gender &&
    profile?.year_of_study != null;
  if (!profileComplete) {
    return '/(auth)/profile-creation';
  }

  const { count } = await supabase
    .from('personality_scores')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (!count) {
    return '/(auth)/personality-quiz';
  }

  return '/(home)';
}
