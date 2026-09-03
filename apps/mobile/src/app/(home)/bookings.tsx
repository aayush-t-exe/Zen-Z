import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import {
  FLOW_CONTENT_MAX,
  FLOW_SIDE_PADDING,
  FlowText,
} from '@/constants/flow-theme';
import { ACTIVITY_ART_BADGE_SCALE, activityArt } from '@/constants/activity-art';
import { FlowSurfaceBox } from '@/components/flow-panel';
import { FlowPillButton } from '@/components/flow-pill-button';
import { SummaryBadge } from '@/components/summary-card';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { fetchMyBookings, fetchMyGroups, MyBooking, MyGroupDetails } from '@/lib/groups';
import { formatSlotDateTime } from '@/lib/format';

/**
 * A card's leading mark: the activity's own render on the same dark badge the
 * summary card seats its glyphs on, rather than the `activity_emoji` these
 * cards used to print at 24pt. Every other screen in the redesign draws its
 * marks, so a system emoji here read as the one thing that hadn't been.
 */
function ActivityRow({
  name,
  cardWidth,
  children,
}: {
  name: string;
  cardWidth: number;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.activityRow}>
      <SummaryBadge
        cardWidth={cardWidth}
        icon={{ source: activityArt(name), scale: ACTIVITY_ART_BADGE_SCALE }}
      />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

export default function BookingsScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);

  // Same content column the rest of the redesign runs.
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

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
        <ActivityIndicator size="large" color={LOADER} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }]}>
        <Text style={[FlowText.titleCentred, { fontSize: 22 }]}>Couldn&apos;t load this.</Text>
        <Text style={[styles.emptyText, styles.emptyTextCentered, { marginTop: 8, marginBottom: 24 }]}>
          {loadError}
        </Text>
        <FlowPillButton label="Retry" width={contentWidth} onPress={load} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, bookings.length === 0 && styles.scrollEmpty]}
        showsVerticalScrollIndicator={false}>
        {/* The scroll centres this column, so the heading and cards range
            left against the same margin the rest of the redesign uses
            instead of each centring on its own width. */}
        <View style={[{ width: contentWidth }, bookings.length === 0 && { flex: 1 }]}>
        <Text style={styles.pageTitle}>Your Events</Text>

        {bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, styles.emptyTextCentered]}>
              No upcoming events yet. Book one to unlock your next adventure.
            </Text>
            <FlowPillButton
              label="Back to home  →"
              width={contentWidth}
              onPress={() => router.push('/(home)')}
            />
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {bookings.map((booking) => {
              const group = groups.find((g) => g.booking_id === booking.id);

              if (booking.status === 'pending_match' && booking.payment_status !== 'paid') {
                const isCancelling = cancellingId === booking.id;
                return (
                  <FlowSurfaceBox key={booking.id} width={contentWidth}>
                    <View style={styles.cardBody}>
                      <Pressable
                        onPress={() =>
                          router.push({
                            pathname: '/(flow)/payment',
                            params: { slotId: booking.slot_id },
                          })
                        }
                        disabled={isCancelling}
                      >
                        <ActivityRow name={booking.activity_name} cardWidth={contentWidth}>
                          <Text style={styles.cardTitle}>{booking.activity_name}</Text>
                          <Text style={styles.cardSubtitle}>Finish unlocking your spot →</Text>
                        </ActivityRow>
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
                  </FlowSurfaceBox>
                );
              }

              if (booking.status === 'pending_match') {
                return (
                  <FlowSurfaceBox key={booking.id} width={contentWidth}>
                    <View style={styles.cardBody}>
                      <ActivityRow name={booking.activity_name} cardWidth={contentWidth}>
                        <Text style={styles.cardTitle}>Your invitation is sealed.</Text>
                        <Text style={styles.cardSubtitle}>
                          {booking.activity_name}, {formatSlotDateTime(booking.slot_datetime, booking.activity_name)}
                        </Text>
                      </ActivityRow>
                    </View>
                  </FlowSurfaceBox>
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
                  >
                    <FlowSurfaceBox width={contentWidth}>
                      <View style={styles.cardBody}>
                        {/* The activity's own mark and name — with two matched
                            bookings (e.g. Cafés + Dinners) this card used to
                            show the same generic 🎭 + "The story begins here."
                            for both, with nothing distinguishing which slot
                            was which. */}
                        <ActivityRow name={group.activity_name} cardWidth={contentWidth}>
                          <Text style={styles.cardTitle}>The story begins here.</Text>
                          <Text style={styles.cardSubtitle}>
                            {group.activity_name} ·{' '}
                            {group.is_revealed ? 'Tap to see your venue and group →' : 'Tap for booking details →'}
                          </Text>
                        </ActivityRow>
                      </View>
                    </FlowSurfaceBox>
                  </Pressable>
                );
              }

              return null;
            })}
          </View>
        )}
        </View>
      </ScrollView>
    </View>
  );
}

/** Matches the primary pill's near-white, same as the progress bar's fill. */
const LOADER = '#FFFDF8';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scroll: {
    alignItems: 'center',
    paddingTop: 56,
    // The floating pill tab bar (home/_layout.tsx) is position: 'absolute',
    // so this screen has to reserve the space itself (bar height 66 + its own
    // 33 bottom offset, plus breathing room) or the last card sits under it.
    // Same allowance the Home screen makes.
    paddingBottom: 116,
  },
  scrollEmpty: {
    flexGrow: 1,
  },
  pageTitle: {
    ...FlowText.title,
    marginBottom: 24,
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
    ...FlowText.subtitle,
    fontSize: 15,
    lineHeight: 21,
  },
  cardBody: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  // Badge then text, at roughly the gap the summary card sets between the two
  // (its label starts 0.28 of the card in, against this row's 22dp padding
  // plus a 51dp badge).
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  cardTitle: {
    ...FlowText.panelLabel,
    fontSize: 17,
  },
  cardSubtitle: {
    ...FlowText.subtitle,
    fontSize: 13,
    marginTop: 4,
  },
  cancelText: {
    color: Palette.error,
    fontSize: 14,
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
});
