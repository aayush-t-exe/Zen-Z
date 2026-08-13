import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { getPostAuthRoute } from '@/lib/authRouting';

export default function Index() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);

  useEffect(() => {
    let cancelled = false;

    const route = async () => {
      if (!session?.user) {
        router.replace('/(auth)/onboarding');
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
  }, [session]);

  return null;
}
