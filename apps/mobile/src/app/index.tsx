import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { getPostAuthRoute } from '@/lib/authRouting';
import { hasSeenJaipurIntro } from '@/lib/launch-intro';

export default function Index() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    // _layout.tsx's boot effect restores the session asynchronously (with
    // retries that can take a few seconds on a cold relaunch) and only
    // flips isLoading to false once that's settled. Reacting to `session`
    // before then means this effect fires with the store's untouched
    // initial value — session: null — and immediately routes to the auth
    // flow even when a valid session is about to load a moment later.
    // Since this screen replaces itself out of the navigation stack, that
    // send-to-auth never gets corrected once the real session arrives:
    // a fully logged-in student ends up stuck looking at the login screen.
    if (isLoading) {
      return;
    }

    let cancelled = false;

    const route = async () => {
      if (!session?.user) {
        const seenIntro = await hasSeenJaipurIntro();
        if (!cancelled) {
          // expo-router's generated route types haven't picked up
          // jaipur-intro.tsx yet at typecheck time — same `as any` escape
          // hatch already used elsewhere for freshly-added routes (see
          // sports-select's router.push in (home)/index.tsx).
          router.replace((seenIntro ? '/(auth)/onboarding' : '/(auth)/jaipur-intro') as any);
        }
        return;
      }

      try {
        const nextRoute = await getPostAuthRoute(session.user.id);
        if (!cancelled) {
          router.replace(nextRoute);
        }
      } catch (err) {
        // getPostAuthRoute already retries transient failures internally —
        // this only fires once that's exhausted. A valid session exists
        // (checked above), so failing toward (home) rather than leaving
        // this screen blank forever (its render is null) is the safer
        // default: worst case the profile/quiz gate needs a manual retry,
        // rather than the session appearing lost entirely.
        console.warn('Failed to resolve post-auth route:', err);
        if (!cancelled) {
          router.replace('/(home)');
        }
      }
    };

    route();

    return () => {
      cancelled = true;
    };
  }, [isLoading, session, router]);

  return null;
}
