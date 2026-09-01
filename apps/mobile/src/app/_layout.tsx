import '@/global.css';
import { useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  InstrumentSans_400Regular,
  InstrumentSans_400Regular_Italic,
  InstrumentSans_500Medium,
  InstrumentSans_500Medium_Italic,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { Inter_700Bold, Inter_800ExtraBold, Inter_900Black } from '@expo-google-fonts/inter';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { NetworkStatusOverlay } from '@/components/network-status-overlay';
import { ErrorBoundary } from '@/components/error-boundary';

SplashScreen.preventAutoHideAsync();

// Purely a dev-mode notice that the test device/browser has the OS-level
// "reduce motion" accessibility setting on — animations still behave
// correctly (per-animation `ReduceMotion.Never` overrides still work, and
// everything else still degrades to instant/disabled as it should for
// users with that setting on). This just silences the noisy LogBox popup.
LogBox.ignoreLogs(['[Reanimated] Reduced motion setting is enabled on this device.']);

const queryClient = new QueryClient();

function RootLayoutContent() {
  const [isReady, setIsReady] = useState(false);
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
      } catch (err) {
        // Swallowing this silently makes "the persisted session failed to
        // load" indistinguishable from "there never was a session" — both
        // land the student back on the logged-out onboarding splash with no
        // trace of which one actually happened. Surface it.
        console.warn('Failed to restore session on boot:', err);
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

  if (!isReady) {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {!session ? (
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="(home)" options={{ headerShown: false }} />
      )}
      {session ? <Stack.Screen name="(flow)" options={{ headerShown: false }} /> : null}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    InstrumentSans_400Regular,
    InstrumentSans_400Regular_Italic,
    InstrumentSans_500Medium,
    InstrumentSans_500Medium_Italic,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    SitkaDisplay_400Regular: require('../../assets/fonts/Sitka-Display-Regular.ttf'),
    SitkaDisplay_700Bold: require('../../assets/fonts/Sitka-Display-Bold.ttf'),
    SFProDisplay_100Thin: require('../../assets/fonts/SFProDisplay-Thin.otf'),
    SFProDisplay_300Light: require('../../assets/fonts/SFProDisplay-Light.otf'),
    SFProDisplay_500Medium: require('../../assets/fonts/SFProDisplay-Medium.otf'),
    SFProDisplay_400Regular_Italic: require('../../assets/fonts/SFProDisplay-RegularItalic.otf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <RootLayoutContent />
          <NetworkStatusOverlay />
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
