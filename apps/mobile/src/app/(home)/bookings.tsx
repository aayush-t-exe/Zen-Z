import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import {
  FLOW_CONTENT_MAX,
  FLOW_SIDE_PADDING,
  FlowSurface,
  FlowText,
} from '@/constants/flow-theme';
import { ACTIVITY_ART_BADGE_SCALE, activityArt } from '@/constants/activity-art';
import { FlowSurfaceBox } from '@/components/flow-panel';
import { FlowPillButton } from '@/components/flow-pill-button';
import { SummaryBadge, summaryBadgeSize } from '@/components/summary-card';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { fetchMyBookings, fetchMyGroups, MyBooking } from '@/lib/groups';
import { formatSlotDateTime } from '@/lib/format';
import { myBookingsKey, myGroupsKey } from '@/lib/queryKeys';

/** Gap from the badge to the label, at roughly the summary card's own. */
const ACTIVITY_ROW_GAP = 13;

/** Side margin the remove-booking confirm dialog sits within. */
const CONFIRM_OVERLAY_PADDING = 28;
/** Confirm dialog's own inset, on all four sides. */
const CONFIRM_CARD_PADDING = 24;

/** Where a card's label column starts, for anything that has to line up with it. */
const activityLabelColumn = (cardWidth: number) =>
  summaryBadgeSize(cardWidth) + ACTIVITY_ROW_GAP;

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
  // The confirm dialog sits narrower than the page column, on its own margin.
  const confirmCardWidth = Math.min(320, screenWidth - CONFIRM_OVERLAY_PADDING * 2);

  const userId = user?.id;
  const queryClient = useQueryClient();

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<MyBooking | null>(null);

  // Cached rather than local useState + a fetch-on-focus effect — this tab
  // stays mounted between visits, so switching back to it used to always
  // show a blank/spinner reset while it refetched from scratch. The groups
  // query shares its key with chats.tsx, so whichever tab fetched most
  // recently warms the other one's cache too.
  const bookingsQuery = useQuery({
    queryKey: myBookingsKey(userId ?? ''),
    queryFn: async () => {
      const result = await fetchMyBookings(userId!);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled: !!userId,
  });

  const groupsQuery = useQuery({
    queryKey: myGroupsKey(userId ?? ''),
    queryFn: async () => {
      const result = await fetchMyGroups();
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled: !!userId,
  });

  const bookings = bookingsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  // A failure here can't just fall back to an empty list — an already
  // paid, already matched booking would silently vanish from this screen
  // (the group lookup below returns null for it), indistinguishable from
  // never having booked anything. Surface it instead.
  const isLoading = bookingsQuery.isLoading || groupsQuery.isLoading;
  const loadError =
    (bookingsQuery.error instanceof Error ? bookingsQuery.error.message : null) ??
    (groupsQuery.error instanceof Error ? groupsQuery.error.message : null);

  const { refetch: refetchBookings } = bookingsQuery;
  const { refetch: refetchGroups } = groupsQuery;
  const refetch = useCallback(() => {
    refetchBookings();
    refetchGroups();
  }, [refetchBookings, refetchGroups]);

  // Still refetches every focus — landing here right after paying or
  // getting matched needs to show that immediately — but now it's a
  // background refresh behind the cached list rather than a full
  // loading-state reset each time.
  useFocusEffect(
    useCallback(() => {
      if (userId) refetch();
    }, [userId, refetch])
  );

  const handleCancelBooking = (booking: MyBooking) => {
    setConfirmCancel(booking);
  };

  const handleConfirmCancel = async () => {
    const booking = confirmCancel;
    if (!booking) return;

    setCancellingId(booking.id);
    const { error } = await supabase.rpc('cancel_unpaid_booking', {
      p_booking_id: booking.id,
    });
    setCancellingId(null);
    setConfirmCancel(null);

    if (error) {
      Alert.alert('Could not cancel', error.message);
      return;
    }

    queryClient.setQueryData(myBookingsKey(userId ?? ''), (prev: MyBooking[] | undefined) =>
      prev ? prev.filter((b) => b.id !== booking.id) : prev
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
        <FlowPillButton label="Retry" width={contentWidth} onPress={refetch} />
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
                        // Indented to the label column above it, past the
                        // badge — it acts on that booking, and hanging it off
                        // the card's own left edge left a ragged step.
                        style={{ marginTop: 14, marginLeft: activityLabelColumn(contentWidth), alignSelf: 'flex-start' }}
                      >
                        {isCancelling ? (
                          <ActivityIndicator size="small" color={Palette.error} />
                        ) : (
                          <Text style={styles.cancelText}>Remove this</Text>
                        )}
                      </Pressable>
                    </View>
                  </FlowSurfaceBox>
                );
              }

              if (booking.status === 'pending_match') {
                return (
                  <Pressable
                    key={booking.id}
                    onPress={() =>
                      router.push({
                        // Not yet in expo-router's generated route types
                        // (brand new screen) — same `as any` precedent
                        // payment.tsx/booking-flow.tsx already use for this.
                        pathname: '/(flow)/whats-next' as any,
                        params: {
                          activityName: booking.activity_name,
                          slotDatetime: booking.slot_datetime,
                        },
                      })
                    }
                  >
                    <FlowSurfaceBox width={contentWidth}>
                      <View style={styles.cardBody}>
                        <ActivityRow name={booking.activity_name} cardWidth={contentWidth}>
                          <Text style={styles.cardTitle}>Your invitation is sealed.</Text>
                          <Text style={styles.cardSubtitle}>
                            {booking.activity_name}, {formatSlotDateTime(booking.slot_datetime, booking.activity_name)}
                            {' · '}Tap to see what happens next →
                          </Text>
                        </ActivityRow>
                      </View>
                    </FlowSurfaceBox>
                  </Pressable>
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

      <Modal
        visible={confirmCancel !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmCancel(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { width: confirmCardWidth }]}>
            <Text style={styles.confirmTitle}>Remove this from Your Events?</Text>
            <Text style={styles.confirmMessage}>
              You haven&apos;t paid for {confirmCancel?.activity_name} yet, but you&apos;ll lose this
              slot. This can&apos;t be undone.
            </Text>
            <View style={styles.confirmActions}>
              <FlowPillButton
                label="Keep it"
                width={confirmCardWidth - CONFIRM_CARD_PADDING * 2}
                onPress={() => setConfirmCancel(null)}
                disabled={cancellingId !== null}
              />
              <Pressable
                onPress={handleConfirmCancel}
                disabled={cancellingId !== null}
                style={styles.confirmRemoveButton}
                hitSlop={8}
              >
                {cancellingId !== null ? (
                  <ActivityIndicator size="small" color={Palette.error} />
                ) : (
                  <Text style={styles.confirmRemoveText}>Remove it</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    gap: ACTIVITY_ROW_GAP,
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
  confirmOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: CONFIRM_OVERLAY_PADDING,
  },
  confirmCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
    padding: CONFIRM_CARD_PADDING,
  },
  confirmTitle: {
    ...FlowText.titleCompact,
    fontSize: 20,
    lineHeight: 24,
    marginBottom: 10,
  },
  confirmMessage: {
    ...FlowText.subtitle,
    fontSize: 14,
    lineHeight: 20,
  },
  confirmActions: {
    marginTop: 24,
    gap: 16,
  },
  confirmRemoveButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  confirmRemoveText: {
    color: Palette.error,
    fontSize: 15,
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
});
