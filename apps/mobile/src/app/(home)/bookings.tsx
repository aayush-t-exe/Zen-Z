import { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/store/auth';
import { fetchMyBookings, fetchMyGroups, MyBooking, MyGroupDetails } from '@/lib/groups';
import { formatSlotDateTime } from '@/lib/format';

export default function BookingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [groups, setGroups] = useState<MyGroupDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      let cancelled = false;

      const load = async () => {
        const [bookingsData, groupsData] = await Promise.all([
          fetchMyBookings(user.id),
          fetchMyGroups(),
        ]);
        if (!cancelled) {
          setBookings(bookingsData);
          setGroups(groupsData);
          setIsLoading(false);
        }
      };

      load();

      return () => {
        cancelled = true;
      };
    }, [user?.id])
  );

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1">
      <ScrollView className="flex-1 px-6 py-8">
        <ThemedText type="title" className="mb-6 text-xl">
          Your Events
        </ThemedText>

        {bookings.length === 0 ? (
          <ThemedText type="default" themeColor="textSecondary">
            No upcoming events yet. Book one to unlock your next adventure.
          </ThemedText>
        ) : (
          <View className="gap-4">
            {bookings.map((booking) => {
              const group = groups.find((g) => g.booking_id === booking.id);

              if (booking.status === 'pending_match' && booking.payment_status !== 'paid') {
                return (
                  <Pressable
                    key={booking.id}
                    onPress={() =>
                      router.push({
                        pathname: '/(home)/payment',
                        params: { slotId: booking.slot_id },
                      })
                    }
                    className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <ThemedText className="mb-2 text-2xl">{booking.activity_emoji}</ThemedText>
                    <ThemedText className="font-semibold">{booking.activity_name}</ThemedText>
                    <ThemedText type="default" themeColor="textSecondary" className="mt-1 text-sm">
                      Finish unlocking your spot →
                    </ThemedText>
                  </Pressable>
                );
              }

              if (booking.status === 'pending_match') {
                return (
                  <View
                    key={booking.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <ThemedText className="mb-2 text-2xl">{booking.activity_emoji}</ThemedText>
                    <ThemedText type="title" className="text-lg">
                      Your invitation is sealed.
                    </ThemedText>
                    <ThemedText type="default" themeColor="textSecondary" className="mt-1 text-sm">
                      {booking.activity_name}, {formatSlotDateTime(booking.slot_datetime)}
                    </ThemedText>
                  </View>
                );
              }

              if (booking.status === 'matched' && group) {
                return (
                  <Pressable
                    key={booking.id}
                    onPress={() =>
                      router.push({
                        pathname: '/(home)/group/[groupId]',
                        params: { groupId: group.group_id },
                      })
                    }
                    className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <ThemedText className="mb-2 text-2xl">🎭</ThemedText>
                    <ThemedText type="title" className="text-lg">
                      The story begins here.
                    </ThemedText>
                    <ThemedText type="default" themeColor="textSecondary" className="mt-1 text-sm">
                      Tap to meet your group →
                    </ThemedText>
                  </Pressable>
                );
              }

              return null;
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
