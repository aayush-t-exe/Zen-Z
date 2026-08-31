import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { getPostAuthRoute } from '@/lib/authRouting';
import { hasSeenJaipurIntro } from '@/lib/launch-intro';

export default function Index() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);

  useEffect(() => {
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

      const nextRoute = await getPostAuthRoute(session.user.id);
      if (!cancelled) {
        router.replace(nextRoute);
      }
    };

    route();

    return () => {
      cancelled = true;
    };
  }, [session, router]);

  return null;
}
