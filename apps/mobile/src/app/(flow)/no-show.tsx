import { useCallback, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { FLOW_CONTENT_MAX, FLOW_SIDE_PADDING, FlowText } from '@/constants/flow-theme';
import { ACTIVITY_ART_BADGE_SCALE, activityArt } from '@/constants/activity-art';
import { FlowPillButton } from '@/components/flow-pill-button';
import { SummaryBadge } from '@/components/summary-card';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { formatSlotDateTime } from '@/lib/format';

/** Matches the primary pill's near-white, as the other redesigned screens set it. */
const LOADER = '#FFFDF8';

interface MissedBooking {
  activity_name: string;
  slot_datetime: string;
}

export default function NoShowScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id);
  const { width: screenWidth } = useWindowDimensions();

  // Same content column the rest of the redesign runs.
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  const [missed, setMissed] = useState<MissedBooking | null>(null);
  const [strikes, setStrikes] = useState(0);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;

      const load = async () => {
        const [bookingResult, profileResult] = await Promise.all([
          bookingId
            ? supabase
                .from('bookings')
                .select('slots:slot_id ( slot_datetime, activity_types:activity_type_id ( name, emoji ) )')
                .eq('id', bookingId)
                .single()
            : Promise.resolve({ data: null }),
          supabase.from('profiles').select('no_show_strikes, booking_blocked_until').eq('id', userId).single(),
        ]);
        if (cancelled) return;

        const slot = (bookingResult.data as any)?.slots;
        if (slot) {
          setMissed({
            activity_name: slot.activity_types?.name ?? 'Activity',
            slot_datetime: slot.slot_datetime,
          });
        }

        if (profileResult.data) {
          const nextBlockedUntil = profileResult.data.booking_blocked_until ?? null;
          setStrikes(profileResult.data.no_show_strikes ?? 0);
          setBlockedUntil(nextBlockedUntil);
          setIsBlocked(nextBlockedUntil ? new Date(nextBlockedUntil).getTime() > Date.now() : false);
        }

        setIsLoading(false);
      };

      load();

      return () => {
        cancelled = true;
      };
    }, [userId, bookingId])
  );

  if (isLoading) {
    return (
      <View style={styles.root}>
        <ActivityIndicator size="large" color={LOADER} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingHorizontal: 24 }]}>
      <View style={{ width: contentWidth, alignItems: 'center' }}>
        {/* The activity's own render where a 🕯️ used to sit: the redesign
            draws its marks, and this one says which evening went empty
            instead of only setting a mood. */}
        {missed && (
          <View style={{ marginBottom: 18 }}>
            <SummaryBadge
              cardWidth={contentWidth}
              icon={{ source: activityArt(missed.activity_name), scale: ACTIVITY_ART_BADGE_SCALE }}
            />
          </View>
        )}

        <Text style={FlowText.titleCentred}>Your seat sat empty tonight.</Text>

        {missed && (
          <Text style={[styles.centredSubtitle, { marginTop: 10 }]}>
            {missed.activity_name}, {formatSlotDateTime(missed.slot_datetime, missed.activity_name)}
          </Text>
        )}

        {isBlocked ? (
          <Text style={[FlowText.error, { marginTop: 26 }]}>
            Three empty seats in a row. Your invitations are paused until{' '}
            {formatSlotDateTime(blockedUntil!)}.
          </Text>
        ) : (
          <Text style={[styles.centredSubtitle, { marginTop: 26 }]}>
            Strike {strikes} of 3. Three in a row pauses new invitations for a week.
          </Text>
        )}

        {/* A way out: this screen opens from a notification tap, and had
            nothing on it to leave with but the OS back gesture. */}
        <FlowPillButton
          label="Back to home  →"
          width={contentWidth}
          onPress={() => router.push('/(home)')}
          style={{ marginTop: 40 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centredSubtitle: {
    ...FlowText.subtitle,
    textAlign: 'center',
  },
});
