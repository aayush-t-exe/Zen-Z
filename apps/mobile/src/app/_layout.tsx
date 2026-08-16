import '@/global.css';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Gabarito_800ExtraBold } from '@expo-google-fonts/gabarito';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from '@expo-google-fonts/hanken-grotesk';
import { MartianMono_600SemiBold } from '@expo-google-fonts/martian-mono';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/hooks/use-theme';

const queryClient = new QueryClient();

// Held until both the session check and the fonts have settled, so the
// first frame is never the stock system face swapping to Gabarito.
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayoutContent() {
  const [isReady, setIsReady] = useState(false);
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Gabarito_800ExtraBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    MartianMono_600SemiBold,
  });
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const session = useAuthStore((state) => state.session);

  useEffect(() => {
    let mounted = true;

    const setupAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (mounted) {
          setSession(session);
          if (session?.user) {
            setUser(session.user);
          }
          setLoading(false);
          setIsReady(true);
        }
      } catch {
        if (mounted) {
          setLoading(false);
          setIsReady(true);
        }
      }
    };

    setupAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        if (session?.user) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [setSession, setUser, setLoading]);

  // A font that fails to load must not wedge the app on the splash
  // screen, so an error counts as settled and we fall through to the
  // system face.
  const fontsSettled = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (isReady && fontsSettled) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady, fontsSettled]);

  if (!isReady || !fontsSettled) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      {!session ? (
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="(home)" options={{ headerShown: false }} />
      )}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutContent />
    </QueryClientProvider>
  );
}
