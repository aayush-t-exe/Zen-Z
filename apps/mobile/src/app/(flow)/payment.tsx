import { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { AuthButton } from '@/components/auth-button';
import { supabase } from '@/lib/supabase';

interface BookingDetails {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  payment_id: string | null;
  paid_via_referral_credit: boolean;
  referral_discount_amount: number;
  plus_one: boolean;
  plus_one_name: string | null;
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

  // Derived from the booking row itself (payment_id is only ever set
  // server-side, by create-payment-order, once a real link exists for
  // *this* booking) rather than tracked as its own local flag. A plain
  // useState here would need perfect resetting on every possible
  // navigation path back to this screen — Expo Router can reuse this
  // screen's mounted instance across different slotIds (e.g. Café
  // payment, back out, book Dinner), and that reset proved fragile in
  // practice. Deriving it instead makes it self-correcting: `booking` is
  // always refetched fresh for the current slotId via useFocusEffect
  // below, so this is automatically right no matter how the screen got
  // here.
  const hasAttemptedPayment = booking?.payment_id != null;

  // Guards the auto-redeem attempt below to exactly once per slotId this
  // screen instance sees — useFocusEffect can refetch repeatedly (e.g.
  // backgrounding and returning to the app), and redeem_referral_credit
  // is already server-side idempotent (a second call just finds no
  // available credit or a booking that's no longer unpaid and returns
  // false), but there's no reason to round-trip it more than once. Keyed
  // on slotId itself (rather than a boolean reset during render, which
  // React disallows mutating a ref in) so it naturally re-arms when this
  // mounted instance gets reused for a different slotId.
  const redeemAttemptedForSlotRef = useRef<string | undefined>(undefined);

  // Expo Router can reuse this screen's mounted instance when navigating
  // here again for a different slotId instead of remounting it — reset
  // the rest of the per-attempt UI state during render (same pattern as
  // booking-flow.tsx's prevActivityNumId) so it happens before paint.
  const [prevSlotId, setPrevSlotId] = useState(slotId);
  if (slotId !== prevSlotId) {
    setPrevSlotId(slotId);
    setBooking(null);
    setIsLoading(true);
    setError('');
    setIsTestMode(false);
  }

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
          payment_id,
          paid_via_referral_credit,
          referral_discount_amount,
          plus_one,
          plus_one_name,
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

      // A fresh, never-attempted booking (no PayU link created yet) is
      // exactly the moment redeem_referral_credit should get a shot at
      // it — the reward is "auto-applied to your next booking," not
      // something the student asks for. A credit is capped at ₹21
      // (0075_referral_partial_credits.sql) — it fully covers a
      // Café/Dinner/Sports-tier booking, but only discounts a pricier
      // one, so `applied` and `fullyCovered` are tracked separately: the
      // student may still owe a discounted remainder through the normal
      // Pay flow below.
      if (
        data.payment_status === 'unpaid' &&
        data.payment_id === null &&
        redeemAttemptedForSlotRef.current !== slotId
      ) {
        redeemAttemptedForSlotRef.current = slotId;
        const { data: redeemResult } = await supabase.rpc('redeem_referral_credit', {
          p_booking_id: data.id,
        });
        if (redeemResult?.applied) {
          // Known outcome of a successful redeem — no need for a second
          // round trip just to read back what we already caused.
          const updated = {
            ...data,
            payment_status: redeemResult.fullyCovered ? 'paid' : data.payment_status,
            paid_via_referral_credit: true,
            referral_discount_amount: redeemResult.discount,
          };
          setBooking(updated);
          return updated as BookingDetails;
        }
      }

      return data as BookingDetails;
    } catch (err) {
      console.error('Error fetching booking:', err);
      setError('Failed to load booking');
    } finally {
      setIsLoading(false);
    }
  }, [slotId]);

  // Expo Router can reuse this screen's mounted instance when navigating
  // back to the same slotId (e.g. cancel a booking, rebook the same slot,
  // land here again) instead of remounting it — a plain useEffect keyed on
  // slotId wouldn't refire since slotId hasn't actually changed, leaving
  // `booking` stuck on the earlier (now-cancelled) row and handlePay
  // submitting its stale id. useFocusEffect refetches every time this
  // screen becomes focused instead, matching the pattern already used by
  // booking-flow.tsx/bookings.tsx/sports-select.tsx.
  useFocusEffect(
    useCallback(() => {
      if (slotId) {
        fetchBooking();
      }
    }, [slotId, fetchBooking])
  );

  const handlePay = async () => {
    if (!booking) {
      setError('Booking not found');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // PayU redirects the checkout browser here once payment is
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

      // hasAttemptedPayment flips to true on its own once this refetch
      // picks up the payment_id create-payment-order already set on the
      // booking row (before it even returned the link) — see its
      // definition above.
      //
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
  const baseFee = activity?.convenience_fee || 21;
  const stickerFee = booking.plus_one ? baseFee * 2 : baseFee;
  const discount = booking.referral_discount_amount || 0;
  // A credit is capped at ₹21 (0075_referral_partial_credits.sql) — it
  // only fully covers the sticker price on a Café/Dinner/Sports-tier
  // booking. Anything pricier still owes the discounted remainder, so
  // "on the house" is only true when the discount actually cleared the
  // whole fee, not just whenever a credit touched this booking at all.
  const fullyCoveredByCredit = discount > 0 && discount >= stickerFee;
  const fee = Math.max(stickerFee - discount, 0);

  if (booking.payment_status === 'paid') {
    return (
      <View style={[styles.root, styles.centered, { paddingHorizontal: 24 }]}>
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Text style={{ fontSize: 44 }}>🔒</Text>
          <Text style={[styles.title, { textAlign: 'center' }]}>
            {fullyCoveredByCredit ? 'Your invitation is sealed — on the house' : 'Your invitation is sealed'}
          </Text>
          <Text style={[styles.subtitle, { textAlign: 'center' }]}>
            {fullyCoveredByCredit
              ? "A friend's invite made this one free. We'll let you know once your table is set."
              : discount > 0
                ? `A friend's invite covered ₹${discount} of this one. We'll let you know once your table is set.`
                : "We'll let you know once your table is set."}
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
            {discount > 0 && (
              <Text style={styles.discountLine}>
                ₹{stickerFee} − ₹{discount} referral credit
              </Text>
            )}
          </View>

          <View style={styles.cardSection}>
            <Text style={styles.includesTitle}>Your unlock includes:</Text>
            <View style={{ gap: 6 }}>
              <Text style={styles.includesItem}>
                ✓ Spot reserved in group of {formatGroupSize(activity?.min_group_size ?? 4, activity?.max_group_size ?? 5)}
              </Text>
              <Text style={styles.includesItem}>✓ Matched with compatible group</Text>
              <Text style={styles.includesItem}>✓ Venue revealed before event</Text>
              {booking.plus_one && (
                <Text style={styles.includesItem}>✓ Bringing a +1: {booking.plus_one_name}</Text>
              )}
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
              Test mode: this is a simulated payment, no real money moves.
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
    fontFamily: FontFamily.display.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: FontFamily.body.regular,
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
    fontFamily: FontFamily.body.bold,
  },
  cardLabel: {
    color: Palette.muted,
    fontSize: 12,
    fontFamily: FontFamily.body.regular,
  },
  feeValue: {
    color: Palette.text,
    fontSize: 30,
    fontWeight: '800',
    fontFamily: FontFamily.body.bold,
  },
  discountLine: {
    color: Palette.muted,
    fontSize: 12,
    fontFamily: FontFamily.body.regular,
    marginTop: 2,
  },
  includesTitle: {
    color: Palette.text,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FontFamily.body.bold,
  },
  includesItem: {
    color: Palette.muted,
    fontSize: 14,
    fontFamily: FontFamily.body.regular,
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
    fontFamily: FontFamily.body.bold,
  },
  noticeBody: {
    color: Palette.muted,
    fontSize: 13,
    fontFamily: FontFamily.body.regular,
  },
  error: {
    color: Palette.error,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
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
    fontFamily: FontFamily.body.bold,
    textAlign: 'center',
  },
});
