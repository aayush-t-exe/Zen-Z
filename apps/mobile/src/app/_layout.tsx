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
import {
  Inter_500Medium,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { NetworkStatusOverlay } from '@/components/network-status-overlay';
import { ErrorBoundary } from '@/components/error-boundary';
import { initSentry, Sentry } from '@/lib/sentry';

SplashScreen.preventAutoHideAsync();
initSentry();

// Temporary — see secureSessionStorage.ts for why. Remove alongside that
// file's instrumentation once the real cause is confirmed from live data.
const DIAGNOSTIC_TAG = 'session-persistence-2026-09-11';

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

    // getSession() only hits the network when the stored access token has
    // already expired and needs refreshing — reopening the app shortly
    // after closing it usually skips that path entirely, but a cold
    // relaunch (task-switcher close, not just backgrounding) can beat the
    // device's network stack reconnecting, especially on the flakier
    // reassociation some Android radios do after a full app kill. Without
    // a retry, that transient failure looked identical to "no session
    // exists" and dropped a genuinely logged-in student back to the email
    // screen — reported live across multiple different phones, not one
    // OEM's battery manager, which is what pointed at this rather than a
    // storage issue.
    const RETRY_DELAYS_MS = [500, 1000, 2000];

    const setupAuth = async () => {
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          // The real fork this whole file's history has been chasing: did
          // getSession() actually resolve with no session (the persisted
          // one is genuinely gone/unrefreshable), or did it only look that
          // way because every retry attempt below threw? Both currently
          // land the student on the login screen identically — this is
          // what tells them apart.
          Sentry.captureMessage(`diagnostic:${DIAGNOSTIC_TAG} getSession resolved`, {
            level: session ? 'info' : 'warning',
            tags: { diagnostic: DIAGNOSTIC_TAG },
            extra: { attempt, hasSession: !!session },
          });

          if (mounted) {
            setSession(session);
            if (session?.user) {
              setUser(session.user);
            }
            setLoading(false);
            setIsReady(true);
          }
          return;
        } catch (err) {
          const isLastAttempt = attempt === RETRY_DELAYS_MS.length;
          console.warn(
            `Failed to restore session on boot (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}):`,
            err
          );
          Sentry.captureException(err, {
            tags: { diagnostic: DIAGNOSTIC_TAG, phase: 'boot-retry' },
            extra: { attempt: attempt + 1, isLastAttempt },
          });
          if (isLastAttempt) {
            // Swallowing this silently makes "the persisted session failed
            // to load" indistinguishable from "there never was a session"
            // — both land the student back on the logged-out onboarding
            // splash with no trace of which one actually happened. Surfaced
            // above via console.warn on every attempt, not just this one.
            if (mounted) {
              setLoading(false);
              setIsReady(true);
            }
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        }
      }
    };

    setupAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Unlike the boot path above, this fires for the lifetime of the app
      // — including a background token-refresh failure well after a
      // successful boot, which would silently sign someone out mid-session
      // with nothing in the retry logic above ever seeing it.
      Sentry.captureMessage(`diagnostic:${DIAGNOSTIC_TAG} auth state change: ${_event}`, {
        level: session ? 'info' : 'warning',
        tags: { diagnostic: DIAGNOSTIC_TAG },
        extra: { event: _event, hasSession: !!session },
      });
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

function RootLayout() {
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
    Inter_500Medium,
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

export default Sentry.wrap(RootLayout);
