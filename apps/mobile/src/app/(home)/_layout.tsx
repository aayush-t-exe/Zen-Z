import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { TabBarIcon } from '@/components/tab-bar-icon';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { useAuthStore } from '@/store/auth';
import { registerForPushNotificationsAsync, addNotificationResponseListener } from '@/lib/notifications';

export default function HomeLayout() {
  const userId = useAuthStore((state) => state.session?.user?.id);

  useEffect(() => {
    if (!userId) return;
    registerForPushNotificationsAsync(userId);

    const subscription = addNotificationResponseListener();
    return () => subscription.remove();
  }, [userId]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Palette.line,
        tabBarInactiveTintColor: Palette.fieldInk,
        tabBarStyle: {
          backgroundColor: Palette.paper,
          borderTopColor: Palette.ring,
          borderTopWidth: 1,
          paddingBottom: 4,
          paddingTop: 8,
          height: 60,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          tabBarIcon: ({ focused }) => <TabBarIcon name="compass" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ focused }) => <TabBarIcon name="calendar" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ focused }) => <TabBarIcon name="message-circle" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabBarIcon name="user" focused={focused} />,
        }}
      />
      {/* Flow screens reached via router.push, not persistent tab destinations */}
      <Tabs.Screen name="sports-select" options={{ href: null }} />
      <Tabs.Screen name="booking-flow" options={{ href: null }} />
      <Tabs.Screen name="payment" options={{ href: null }} />
      <Tabs.Screen name="payment-callback" options={{ href: null }} />
      <Tabs.Screen name="group/[groupId]" options={{ href: null }} />
      <Tabs.Screen name="no-show" options={{ href: null }} />
    </Tabs>
  );
}
