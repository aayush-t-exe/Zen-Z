import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { HomeTabBar } from '@/components/home-tab-bar';
import { useAuthStore } from '@/store/auth';
import { useChatStore } from '@/store/chat';
import { registerForPushNotificationsAsync, addNotificationResponseListener } from '@/lib/notifications';
import { getPostAuthRoute } from '@/lib/authRouting';

const UNREAD_POLL_MS = 20000;

export default function HomeLayout() {
  const userId = useAuthStore((state) => state.session?.user?.id);
  const unreadCount = useChatStore((state) => state.unreadCount);
  const refreshUnreadCount = useChatStore((state) => state.refreshUnreadCount);

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
  );
}
