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

  const profileComplete = !!profile?.full_name && !!profile?.gender && profile?.year_of_study != null;
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
