import { useCallback, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon, ActivityIcon } from '@/components/icon';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { formatSlotDateTime } from '@/lib/format';

interface MissedBooking {
  activity_name: string;
  activity_icon_key: string;
  slot_datetime: string;
}

export default function NoShowScreen() {
  const theme = useTheme();
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
                .select('slots:slot_id ( slot_datetime, activity_types:activity_type_id ( name, icon_key ) )')
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
            activity_icon_key: slot.activity_types?.icon_key ?? '',
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
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1 items-center justify-center px-6">
      <View className="mb-3">
        <Icon name="warning" size={34} color={theme.textSecondary} weight={2.4} />
      </View>
      <ThemedText type="title" className="text-center text-lg">
        Your seat sat empty tonight.
      </ThemedText>

      {missed && (
        <View className="mt-2 flex-row items-center gap-2">
          <ActivityIcon iconKey={missed.activity_icon_key} size={17} color={theme.textSecondary} />
          <ThemedText type="default" themeColor="textSecondary" className="text-sm">
            {missed.activity_name}, {formatSlotDateTime(missed.slot_datetime)}
          </ThemedText>
        </View>
      )}

      {isBlocked ? (
        <ThemedText type="default" themeColor="error" className="mt-6 text-center text-sm">
          Three empty seats in a row. Your invitations are paused until{' '}
          {formatSlotDateTime(blockedUntil!)}.
        </ThemedText>
      ) : (
        <ThemedText type="default" themeColor="textSecondary" className="mt-6 text-center text-sm">
          Strike {strikes} of 3. Three in a row pauses new invitations for a week.
        </ThemedText>
      )}
    </ThemedView>
  );
}
