import { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { Tabs, router, usePathname } from 'expo-router';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeTabBar, HOME_TAB_BAR_HEIGHT, homeTabBarBottomMargin } from '@/components/home-tab-bar';
import { FlowSurface, FlowText } from '@/constants/flow-theme';
import { useAuthStore } from '@/store/auth';
import { useChatStore } from '@/store/chat';
import { registerForPushNotificationsAsync, addNotificationResponseListener } from '@/lib/notifications';
import { getPostAuthRoute } from '@/lib/authRouting';

const UNREAD_POLL_MS = 20000;
/** How long a first back press stays armed, waiting for the confirming second one. */
const EXIT_PRESS_WINDOW_MS = 2000;
/** Clear of the floating tab bar, on top of its own bottom margin. */
const EXIT_TOAST_GAP = 14;

export default function HomeLayout() {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const unreadCount = useChatStore((state) => state.unreadCount);
  const refreshUnreadCount = useChatStore((state) => state.refreshUnreadCount);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [exitToastVisible, setExitToastVisible] = useState(false);
  const exitArmedRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Android's hardware/gesture back button was doing nothing at all on
  // Discover — the tab navigator sits at the root of the whole app with
  // nowhere left to pop to, and whatever default fallback is supposed to
  // exit the app there wasn't firing (confirmed on a tester's device: many
  // repeated back presses on Discover, zero effect). Left as-is, a student
  // can get stuck unable to leave the app without the task switcher — not
  // just an inconvenience but a hard Play Store review rejection (back
  // button must always do *something* sensible).
  //
  // Scoped to Discover (`pathname === '/'`) only: every other route either
  // has real back history (the (flow) stack, or another tab) that should
  // keep popping as normal, or already owns its own hardwareBackPress
  // handler (payment.tsx) which this must not shadow. Returning `false`
  // for anything but Discover leaves that untouched.
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const disarm = () => {
      exitArmedRef.current = false;
      setExitToastVisible(false);
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (pathnameRef.current !== '/') return false;

      if (exitArmedRef.current) {
        disarm();
        BackHandler.exitApp();
        return true;
      }

      exitArmedRef.current = true;
      setExitToastVisible(true);
      exitTimerRef.current = setTimeout(disarm, EXIT_PRESS_WINDOW_MS);
      return true;
    });

    return () => {
      subscription.remove();
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  const toastStyle = useAnimatedStyle(() => ({
    opacity: withTiming(exitToastVisible ? 1 : 0, { duration: 180 }),
  }));

  useEffect(() => {
    if (!userId) return;
    registerForPushNotificationsAsync(userId);

    const subscription = addNotificationResponseListener();
    return () => subscription.remove();
  }, [userId]);

  // Polling rather than a realtime subscription here — this layout
  // doesn't know which groups the user is in ahead of time, and a
  // table-wide messages subscription with no group_id filter would need
  // RLS-aware realtime broadcast (not something this project's Supabase
  // setup relies on elsewhere — see group/[groupId].tsx's per-group
  // filtered channel). group/[groupId].tsx refreshes this immediately
  // after marking its own group read, so the badge doesn't wait a full
  // poll cycle to clear once a chat is actually opened.
  useEffect(() => {
    if (!userId) return;
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, UNREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [userId, refreshUnreadCount]);

  // A live session isn't proof onboarding is finished — this stack mounts
  // as soon as a session exists, and Expo Router will resolve any deep
  // link (a push notification tap, a relaunch) straight to a route inside
  // it without ever passing through index.tsx or the OTP-success handler.
  // Re-run the same completeness check here so no entry point skips it.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    getPostAuthRoute(userId).then((route) => {
      if (!cancelled && route !== '/(home)') {
        router.replace(route);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <View style={styles.root}>
      <Tabs
        // The bar is drawn by HomeTabBar rather than configured through
        // tabBar* options — see the note in that file for why the default one
        // can't produce this layout.
        tabBar={(props) => <HomeTabBar {...props} />}
        screenOptions={{ headerShown: false }}>
        {/* Icons and labels live in HomeTabBar; these screens only carry the
            title and the unread badge. */}
        <Tabs.Screen name="index" options={{ title: 'Discover' }} />
        <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
        <Tabs.Screen
          name="chats"
          options={{
            // Route stays `chats` (store, deep links and notification routing all
            // key off that); only the visible label follows the comp.
            title: 'Messages',
            tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          }}
        />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.exitToastContainer,
          { bottom: homeTabBarBottomMargin(insets.bottom) + HOME_TAB_BAR_HEIGHT + EXIT_TOAST_GAP },
          toastStyle,
        ]}>
        <View style={styles.exitToastPill}>
          <Text style={FlowText.link}>Tap back again to exit</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  exitToastContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  exitToastPill: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
  },
});
