import { useCallback, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { formatSlotDateTime } from '@/lib/format';

interface MissedBooking {
  activity_name: string;
  activity_emoji: string;
  slot_datetime: string;
}

export default function NoShowScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const userId = useAuthStore((state) => state.user?.id);

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
            activity_emoji: slot.activity_types?.emoji ?? '',
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
        <ActivityIndicator size="large" color={Palette.text} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingHorizontal: 24 }]}>
      <Text style={styles.emoji}>🕯️</Text>
      <Text style={styles.title}>Your seat sat empty tonight.</Text>

      {missed && (
        <Text style={[styles.subtitle, { marginTop: 8 }]}>
          {missed.activity_emoji} {missed.activity_name}, {formatSlotDateTime(missed.slot_datetime, missed.activity_name)}
        </Text>
      )}

      {isBlocked ? (
        <Text style={[styles.subtitle, { marginTop: 24, color: Palette.error }]}>
          Three empty seats in a row. Your invitations are paused until{' '}
          {formatSlotDateTime(blockedUntil!)}.
        </Text>
      ) : (
        <Text style={[styles.subtitle, { marginTop: 24 }]}>
          Strike {strikes} of 3. Three in a row pauses new invitations for a week.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  title: {
    color: Palette.text,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.body.regular,
    textAlign: 'center',
  },
});
