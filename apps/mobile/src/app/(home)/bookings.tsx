import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
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
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Palette.text} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Your Events</Text>

        {bookings.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming events yet. Book one to unlock your next adventure.</Text>
        ) : (
          <View style={{ gap: 14 }}>
            {bookings.map((booking) => {
              const group = groups.find((g) => g.booking_id === booking.id);

              if (booking.status === 'pending_match' && booking.payment_status !== 'paid') {
                const isCancelling = cancellingId === booking.id;
                return (
                  <View key={booking.id} style={styles.card}>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/(home)/payment',
                          params: { slotId: booking.slot_id },
                        })
                      }
                      disabled={isCancelling}
                    >
                      <Text style={styles.cardEmoji}>{booking.activity_emoji}</Text>
                      <Text style={styles.cardTitle}>{booking.activity_name}</Text>
                      <Text style={styles.cardSubtitle}>Finish unlocking your spot →</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleCancelBooking(booking)}
                      disabled={isCancelling}
                      style={{ marginTop: 14, alignSelf: 'flex-start' }}
                    >
                      {isCancelling ? (
                        <ActivityIndicator size="small" color={Palette.error} />
                      ) : (
                        <Text style={styles.cancelText}>Cancel booking</Text>
                      )}
                    </Pressable>
                  </View>
                );
              }

              if (booking.status === 'pending_match') {
                return (
                  <View key={booking.id} style={styles.card}>
                    <Text style={styles.cardEmoji}>{booking.activity_emoji}</Text>
                    <Text style={styles.cardTitle}>Your invitation is sealed.</Text>
                    <Text style={styles.cardSubtitle}>
                      {booking.activity_name}, {formatSlotDateTime(booking.slot_datetime)}
                    </Text>
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
                    style={styles.card}
                  >
                    <Text style={styles.cardEmoji}>🎭</Text>
                    <Text style={styles.cardTitle}>The story begins here.</Text>
                    <Text style={styles.cardSubtitle}>Tap to meet your group →</Text>
                  </Pressable>
                );
              }

              return null;
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  pageTitle: {
    color: Palette.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  emptyText: {
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    borderWidth: 2.5,
    borderColor: Palette.ring,
    borderRadius: 20,
    padding: 18,
  },
  cardEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  cardTitle: {
    color: Palette.text,
    fontSize: 17,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: Palette.muted,
    fontSize: 14,
    marginTop: 4,
  },
  cancelText: {
    color: Palette.error,
    fontSize: 14,
    fontWeight: '600',
  },
});
