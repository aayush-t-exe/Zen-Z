import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { AuthButton } from '@/components/auth-button';
import { supabase } from '@/lib/supabase';

interface BookingDetails {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  slots: any;
}

const PAYMENT_POLL_ATTEMPTS = 5;
const PAYMENT_POLL_DELAY_MS = 1500;

// Games like 8-Ball Pool and Pickleball have a fixed group size (min ===
// max) — "group of 4–4" reads as a typo, so collapse it to a single number.
const formatGroupSize = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);

const ACTIVITY_ICONS: Record<string, any> = {
  Cafés: require('@/assets/images/icon-cafes.png'),
  Dinners: require('@/assets/images/icon-dinners.png'),
  Movies: require('@/assets/images/icon-movies.png'),
  Sports: require('@/assets/images/icon-sports.png'),
  // A Sports booking carries the specific game's name (not "Sports") —
  // same gap that left the booking-flow summary icon blank for these.
  'Box Cricket': require('@/assets/images/icon-cricket.png'),
  Football: require('@/assets/images/icon-football.png'),
  '8-Ball Pool': require('@/assets/images/icon-pool.png'),
  Pickleball: require('@/assets/images/icon-pickleball.png'),
};

export default function PaymentScreen() {
  const router = useRouter();
  const { slotId } = useLocalSearchParams<{ slotId: string }>();

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isTestMode, setIsTestMode] = useState(false);
  const [hasAttemptedPayment, setHasAttemptedPayment] = useState(false);

  const fetchBooking = useCallback(async () => {
    try {
      // Get the latest booking for this slot
      const { data, error: fetchError } = await supabase
        .from('bookings')
        .select(`
          id,
          user_id,
          status,
          payment_status,
          slots:slot_id (
            activity_type_id,
            activity_types:activity_type_id (
              name,
              emoji,
              convenience_fee,
              min_group_size,
              max_group_size
            )
          )
        `)
        .eq('slot_id', slotId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !data) {
        setError('Could not load booking details');
        return;
      }

      setBooking(data);
      return data as BookingDetails;
    } catch (err) {
      console.error('Error fetching booking:', err);
      setError('Failed to load booking');
    } finally {
      setIsLoading(false);
    }
  }, [slotId]);

  useEffect(() => {
    if (slotId) {
      // fetchBooking is async — its setState calls happen in a later
      // microtask after this effect body has already returned, not
      // synchronously within it, so this isn't the cascading-render
      // pattern the rule is guarding against. This is the standard
      // fetch-on-mount shape.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchBooking();
    }
  }, [slotId, fetchBooking]);

  const handlePay = async () => {
    if (!booking) {
      setError('Booking not found');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Razorpay redirects the checkout browser here once payment is
      // attempted — openAuthSessionAsync below watches for exactly this
      // URL and hands control back to the app the moment it fires,
      // instead of sitting open until the user manually backs out. That
      // interception isn't reliable on every device/browser combo though
      // — carrying slotId lets the payment-callback route land the user
      // back on the right booking's payment screen even when the OS
      // opens this as a fresh deep link instead of openAuthSessionAsync
      // catching it.
      const redirectUrl = Linking.createURL('payment-callback', {
        queryParams: { slotId: slotId || '' },
      });

      const { data, error: functionError } = await supabase.functions.invoke(
        'create-payment-order',
        {
          body: {
            bookingId: booking.id,
            redirectUrl,
          },
        }
      );

      if (functionError) {
        // supabase-js only gives a generic "non-2xx status" message by
        // default — the actual reason is in the response body, on
        // FunctionsHttpError's `context` (the raw Response).
        let message = functionError.message || 'Failed to create payment link';
        const context = (functionError as any).context;
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json();
            if (body?.error) message = body.error;
          } catch {
            // Body wasn't JSON — fall back to the generic message.
          }
        }
        setError(message);
        return;
      }

      if (!data.success) {
        setError(data.error || 'Failed to create payment link');
        return;
      }

      setIsTestMode(!!data.is_test_mode);

      await WebBrowser.openAuthSessionAsync(data.payment_link_url, redirectUrl);

      setHasAttemptedPayment(true);

      // The redirect fires as soon as the payment is attempted, but the
      // webhook that actually flips payment_status can lag behind it by
      // a second or two — poll briefly instead of trusting a single
      // fetch immediately after the browser closes.
      for (let attempt = 0; attempt < PAYMENT_POLL_ATTEMPTS; attempt++) {
        const refreshed = await fetchBooking();
        if (refreshed?.payment_status === 'paid') break;
        if (attempt < PAYMENT_POLL_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, PAYMENT_POLL_DELAY_MS));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Payment error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckAgain = async () => {
    setIsProcessing(true);
    await fetchBooking();
    setIsProcessing(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={Palette.text} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.root, styles.centered, { paddingHorizontal: 24 }]}>
        <View style={{ gap: 14 }}>
          <Text style={styles.title}>Booking Not Found</Text>
          <Text style={styles.subtitle}>{error || 'Could not load your booking.'}</Text>
          <AuthButton label="Go Back" onPress={() => router.push('/(home)')} />
        </View>
      </View>
    );
  }

  const activity = booking.slots?.activity_types;
  const fee = activity?.convenience_fee || 21;

  if (booking.payment_status === 'paid') {
    return (
      <View style={[styles.root, styles.centered, { paddingHorizontal: 24 }]}>
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Text style={{ fontSize: 44 }}>🔒</Text>
          <Text style={[styles.title, { textAlign: 'center' }]}>Your invitation is sealed</Text>
          <Text style={[styles.subtitle, { textAlign: 'center' }]}>
            We&apos;ll let you know once your table is set.
          </Text>
          <AuthButton label="Continue  →" onPress={() => router.push('/(home)')} style={{ marginTop: 8 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 6, marginBottom: 20 }}>
          <Text style={styles.title}>Unlock Your Adventure</Text>
          <Text style={styles.subtitle}>Complete your payment to confirm your spot</Text>
        </View>

        {/* Order Summary */}
        <View style={styles.card}>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Image
              source={ACTIVITY_ICONS[activity?.name]}
              style={{ width: 40, height: 40 }}
              resizeMode="contain"
            />
            <Text style={styles.activityName}>{activity?.name}</Text>
          </View>

          <View style={[styles.cardSection, { alignItems: 'center' }]}>
            <Text style={styles.cardLabel}>Convenience fee</Text>
            <Text style={styles.feeValue}>₹{fee}</Text>
          </View>

          <View style={styles.cardSection}>
            <Text style={styles.includesTitle}>Your unlock includes:</Text>
            <View style={{ gap: 6 }}>
              <Text style={styles.includesItem}>
                ✓ Spot reserved in group of {formatGroupSize(activity?.min_group_size ?? 4, activity?.max_group_size ?? 5)}
              </Text>
              <Text style={styles.includesItem}>✓ Matched with compatible group</Text>
              <Text style={styles.includesItem}>✓ Venue revealed before event</Text>
            </View>
          </View>
        </View>

        {hasAttemptedPayment && booking.payment_status !== 'paid' && (
          <View style={[styles.noticeBox, { marginTop: 20 }]}>
            <Text style={styles.noticeTitle}>We haven&apos;t received your payment yet</Text>
            <Text style={styles.noticeBody}>
              If you completed payment, give it a moment and check again.
            </Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isTestMode && (
          <View style={[styles.noticeBox, { marginTop: 20 }]}>
            <Text style={styles.noticeBody}>
              Test mode: this is a simulated Razorpay payment, no real money moves.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Payment Button */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32, gap: 14 }}>
        {hasAttemptedPayment && booking.payment_status !== 'paid' && (
          <Pressable onPress={handleCheckAgain} disabled={isProcessing} style={styles.secondaryButton}>
            <Text style={styles.secondaryLabel}>Check Again</Text>
          </Pressable>
        )}

        <AuthButton
          label={hasAttemptedPayment ? 'Try Again  →' : `Pay ₹${fee} to Unlock  →`}
          onPress={handlePay}
          loading={isProcessing}
        />

        <Pressable onPress={() => router.push('/(home)')} disabled={isProcessing} style={styles.secondaryButton}>
          <Text style={styles.secondaryLabel}>Maybe Later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  title: {
    color: Palette.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 21,
  },
  card: {
    borderWidth: 2.5,
    borderColor: Palette.ring,
    borderRadius: 20,
    padding: 20,
    gap: 18,
  },
  cardSection: {
    borderTopWidth: 1,
    borderTopColor: Palette.ring,
    paddingTop: 16,
    gap: 6,
  },
  activityName: {
    color: Palette.text,
    fontSize: 17,
    fontWeight: '700',
  },
  cardLabel: {
    color: Palette.muted,
    fontSize: 12,
  },
  feeValue: {
    color: Palette.text,
    fontSize: 30,
    fontWeight: '800',
  },
  includesTitle: {
    color: Palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  includesItem: {
    color: Palette.muted,
    fontSize: 14,
  },
  noticeBox: {
    borderWidth: 2,
    borderColor: Palette.ring,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  noticeTitle: {
    color: Palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  noticeBody: {
    color: Palette.muted,
    fontSize: 13,
  },
  error: {
    color: Palette.error,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: Palette.ring,
    borderRadius: 27,
    paddingVertical: 14,
  },
  secondaryLabel: {
    color: Palette.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
