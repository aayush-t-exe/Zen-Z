import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { TabBarIcon } from '@/components/tab-bar-icon';
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
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          borderTopColor: '#e5e7eb',
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
          tabBarIcon: ({ color }) => <TabBarIcon name="compass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color }) => <TabBarIcon name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color }) => <TabBarIcon name="message-circle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
      {/* Flow screens reached via router.push, not persistent tab destinations */}
      <Tabs.Screen name="booking-flow" options={{ href: null }} />
      <Tabs.Screen name="payment" options={{ href: null }} />
      <Tabs.Screen name="payment-callback" options={{ href: null }} />
      <Tabs.Screen name="group/[groupId]" options={{ href: null }} />
      <Tabs.Screen name="no-show" options={{ href: null }} />
    </Tabs>
  );
}
