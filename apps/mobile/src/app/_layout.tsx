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
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { NetworkStatusOverlay } from '@/components/network-status-overlay';
import { AddToHomeScreenBanner } from '@/components/add-to-home-screen-banner';
import { ErrorBoundary } from '@/components/error-boundary';
import { initSentry, Sentry } from '@/lib/sentry';

SplashScreen.preventAutoHideAsync();
initSentry();

// Purely a dev-mode notice that the test device/browser has the OS-level
// "reduce motion" accessibility setting on — animations still behave
// correctly (per-animation `ReduceMotion.Never` overrides still work, and
// everything else still degrades to instant/disabled as it should for
// users with that setting on). This just silences the noisy LogBox popup.
LogBox.ignoreLogs(['[Reanimated] Reduced motion setting is enabled on this device.']);

const queryClient = new QueryClient();

function RootLayoutContent({ onReady }: { onReady: () => void }) {
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
    const GET_SESSION_TIMEOUT_MS = 6000;

    const setupAuth = async () => {
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
          // getSession() can hang indefinitely — neither resolve nor reject
          // — on a degraded connection (TCP handshake succeeds, response
          // never lands), which the retry loop below can't see since it
          // only reacts to thrown errors. Racing a timeout converts that
          // hang into a retryable failure instead of a permanently stuck
          // splash screen.
          const {
            data: { session },
            error: sessionError,
          } = await Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error('getSession timed out')),
                GET_SESSION_TIMEOUT_MS
              )
            ),
          ]);

          // getSession() doesn't throw when the expired-token refresh hits a
          // network error — it resolves with session: null plus an
          // AuthRetryableFetchError, leaving the stored session intact on
          // disk. Treating that as "logged out" sent a genuinely signed-in
          // student to onboarding on any cold start over weak data; throwing
          // routes it through the retry loop below instead.
          if (sessionError && isAuthRetryableFetchError(sessionError)) {
            throw sessionError;
          }

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
          if (isLastAttempt) {
            // Every retry failed, so the student lands on the logged-out
            // screen even though a session may still be stored. Report it
            // once here (not per attempt) so it stays visible in Sentry
            // without flooding the quota on a flaky network.
            Sentry.captureException(err, {
              tags: { area: 'session-restore', phase: 'boot-retry-exhausted' },
              extra: { attempts: attempt + 1 },
            });
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

  useEffect(() => {
    if (isReady) {
      onReady();
    }
  }, [isReady, onReady]);

  // Deliberately no blanket safe-area padding here. Applying it to every
  // screen stacked it on top of each screen's own top padding (88 on the
  // booking flow, 56 on the auth screens — both tuned against the comps),
  // costing ~60dp of height on screens that already cleared the status bar
  // and pushing the booking flow's "Bring a +1" row below the fold. Only
  // Discover actually starts flush with the top, so it reserves the inset
  // itself.
  const screenOptions = { headerShown: false, contentStyle: { backgroundColor: '#000000' } };

  if (!isReady) {
    return <Stack screenOptions={screenOptions} />;
  }

  return (
    <Stack screenOptions={screenOptions}>
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
  const [authReady, setAuthReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
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

  // A single font failing or timing out (expo-font gives each ~12s on web,
  // across ~4MB of files on congested campus Wi-Fi) left fontsLoaded false
  // forever and rendered nothing — a permanent black screen. On error, carry
  // on with the system font fallback instead.
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    // Hiding the splash as soon as fonts load (before auth restore below has
    // finished) exposed the navigator's default white background for the
    // rest of the boot sequence — up to ~3.5s on a cold relaunch, since
    // RootLayoutContent's session restore retries. Keeping the (black)
    // splash up until both are ready removes that white flash entirely.
    if (fontsReady && authReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady, authReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <RootLayoutContent onReady={() => setAuthReady(true)} />
          <NetworkStatusOverlay />
          <AddToHomeScreenBanner />
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
