import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth';

export default function Index() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);

  useEffect(() => {
    if (session) {
      router.replace('/(home)');
    } else {
      router.replace('/(auth)/onboarding');
    }
  }, [session]);

  return null;
}
