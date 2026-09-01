import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { AuthButton } from '@/components/auth-button';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    const [bookingsResult, groupsResult] = await Promise.all([
      fetchMyBookings(user.id),
      fetchMyGroups(),
    ]);

    // A failure here can't just fall back to an empty list — an already
    // paid, already matched booking would silently vanish from this screen
    // (the group lookup below returns null for it), indistinguishable from
    // never having booked anything. Surface it instead.
    if (bookingsResult.error || groupsResult.error) {
      setLoadError(bookingsResult.error ?? groupsResult.error);
      setIsLoading(false);
      return;
    }

    setBookings(bookingsResult.data);
    setGroups(groupsResult.data);
    setIsLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
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

  if (loadError) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }]}>
        <Text style={[styles.pageTitle, { textAlign: 'center' }]}>Couldn&apos;t load this.</Text>
        <Text style={[styles.emptyText, styles.emptyTextCentered, { marginTop: 8, marginBottom: 24 }]}>
          {loadError}
        </Text>
        <AuthButton label="Retry" onPress={load} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, bookings.length === 0 && styles.scrollEmpty]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Your Events</Text>

        {bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, styles.emptyTextCentered]}>
              No upcoming events yet. Book one to unlock your next adventure.
            </Text>
            <AuthButton label="Back to home  →" onPress={() => router.push('/(home)')} />
          </View>
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
                          pathname: '/(flow)/payment',
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
                      {booking.activity_name}, {formatSlotDateTime(booking.slot_datetime, booking.activity_name)}
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
                        pathname: '/(flow)/booking-details',
                        params: { groupId: group.group_id },
                      })
                    }
                    style={styles.card}
                  >
                    {/* activity_emoji/activity_name — with two matched
                        bookings (e.g. Cafés + Dinners) this card used to
                        show the same generic 🎭 + "The story begins here."
                        for both, with nothing distinguishing which slot
                        was which. */}
                    <Text style={styles.cardEmoji}>{group.activity_emoji}</Text>
                    <Text style={styles.cardTitle}>The story begins here.</Text>
                    <Text style={styles.cardSubtitle}>
                      {group.activity_name} ·{' '}
                      {group.is_revealed ? 'Tap to see your venue and group →' : 'Tap for booking details →'}
                    </Text>
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
  scrollEmpty: {
    flexGrow: 1,
  },
  pageTitle: {
    color: Palette.text,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
    marginBottom: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  emptyTextCentered: {
    textAlign: 'center',
  },
  emptyText: {
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: FontFamily.body.regular,
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
    fontFamily: FontFamily.display.bold,
  },
  cardSubtitle: {
    color: Palette.muted,
    fontSize: 14,
    fontFamily: FontFamily.body.regular,
    marginTop: 4,
  },
  cancelText: {
    color: Palette.error,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
  },
});
