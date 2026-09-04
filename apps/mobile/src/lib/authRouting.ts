import { supabase } from '@/lib/supabase';

export type PostAuthRoute = '/(auth)/profile-creation' | '/(auth)/personality-quiz' | '/(home)';

const RETRY_DELAYS_MS = [500, 1000, 2000];

// This always makes a live network call regardless of whether the
// session itself needed refreshing, unlike getSession() — so it's the
// part of the boot sequence most exposed to a transient "network hasn't
// reconnected yet" window right after a cold relaunch (task-switcher
// close, not just backgrounding). Both queries below used to have no
// error check at all: a failed fetch and a genuinely-incomplete profile
// both resolved to the exact same "data is undefined" shape, so a
// network hiccup silently bounced an already-onboarded student back into
// the auth flow. Retrying (same backoff as _layout.tsx's getSession()
// restore) and throwing on the caller's behalf, rather than treating a
// failure as "incomplete," is what actually fixes that — reported live
// across multiple different phones, not one OEM's battery manager.
async function withRetry<T extends { error: unknown }>(fn: () => PromiseLike<T>): Promise<T> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const result = await fn();
    if (!result.error) return result;
    if (attempt === RETRY_DELAYS_MS.length) throw result.error;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
  throw new Error('unreachable');
}

// A valid session isn't enough to land in (home) — a user can have a
// session but never have finished profile creation or the personality
// quiz (killed the app mid-onboarding, etc). Both the OTP-verification
// success path and app-boot session restore need this same decision, so
// it lives here once rather than drifting between two copies.
export async function getPostAuthRoute(userId: string): Promise<PostAuthRoute> {
  const { data: profile } = await withRetry(() =>
    supabase.from('profiles').select('full_name, gender, year_of_study').eq('id', userId).single()
  );

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

  const { count } = await withRetry(() =>
    supabase.from('personality_scores').select('*', { count: 'exact', head: true }).eq('user_id', userId)
  );

  if (!count) {
    return '/(auth)/personality-quiz';
  }

  return '/(home)';
}
