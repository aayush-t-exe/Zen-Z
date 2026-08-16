import { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { fetchMyBookings, fetchMyGroups, MyBooking, MyGroupDetails } from '@/lib/groups';
import { formatSlotDateTime } from '@/lib/format';

export default function BookingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [groups, setGroups] = useState<MyGroupDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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
    }, [user])
  );

  const handleCancelBooking = (booking: MyBooking) => {
    Alert.alert(
      'Cancel this booking?',
      `You'll lose your spot for ${booking.activity_name}. This can't be undone.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(booking.id);
            const { error } = await supabase.rpc('cancel_unpaid_booking', {
              p_booking_id: booking.id,
            });
            setCancellingId(null);

            if (error) {
              Alert.alert('Could not cancel', error.message);
              return;
            }

            setBookings((prev) => prev.filter((b) => b.id !== booking.id));
          },
        },
      ]
    );
  };

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
                const isCancelling = cancellingId === booking.id;
                return (
                  <View
                    key={booking.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
                  >
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/(home)/payment',
                          params: { slotId: booking.slot_id },
                        })
                      }
                      disabled={isCancelling}
                    >
                      <ThemedText className="mb-2 text-2xl">{booking.activity_emoji}</ThemedText>
                      <ThemedText className="font-semibold">{booking.activity_name}</ThemedText>
                      <ThemedText type="default" themeColor="textSecondary" className="mt-1 text-sm">
                        Finish unlocking your spot →
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      onPress={() => handleCancelBooking(booking)}
                      disabled={isCancelling}
                      className="mt-4 self-start"
                    >
                      {isCancelling ? (
                        <ActivityIndicator size="small" />
                      ) : (
                        <ThemedText type="default" themeColor="error" className="text-sm font-medium">
                          Cancel booking
                        </ThemedText>
                      )}
                    </Pressable>
                  </View>
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
