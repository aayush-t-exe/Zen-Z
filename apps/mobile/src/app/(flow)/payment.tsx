import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { ACTIVITY_ART_BADGE_SCALE, activityArt } from '@/constants/activity-art';
import { FLOW_CONTENT_MAX, FLOW_SIDE_PADDING, FlowText } from '@/constants/flow-theme';
import { FlowSurfaceBox } from '@/components/flow-panel';
import { FlowPillButton } from '@/components/flow-pill-button';
import { FlowBackButton } from '@/components/flow-back-button';
import { SUMMARY_ICONS, SummaryCard } from '@/components/summary-card';
import { supabase } from '@/lib/supabase';
import { formatSlotDateTime } from '@/lib/format';

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

/** The comp's own tick (UI PAGE 5), standing in for a list bullet. */
const TICK = require('@/assets/images/icon-tick.png');
/** icon-tick.png is 42x31. */
const TICK_ASPECT = 31 / 42;

function IncludedLine({ label }: { label: string }) {
  return (
    <View style={styles.includedRow}>
      <Image
        source={TICK}
        style={styles.includedTick}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.includedLabel}>{label}</Text>
    </View>
  );
}

export default function PaymentScreen() {
  const router = useRouter();
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
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
            slot_datetime,
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

  // Loading this screen (via booking-flow.tsx's "resume an existing unpaid
  // booking" redirect, see its loadActivityAndSlots) is a dead end otherwise
  // — the only way back to slot selection was rediscovering Bookings and
  // cancelling from there. cancel_unpaid_booking (0029, extended by 0075 to
  // also restore a consumed referral credit) is the same RPC bookings.tsx
  // already uses, so this stays consistent with that cancel path rather than
  // inventing a second one.
  const handleCancelAndChooseAgain = () => {
    if (!booking) return;
    const activityTypeId = booking.slots?.activity_type_id;

    Alert.alert(
      'Choose a different slot?',
      "This cancels your unpaid booking for this slot so you can pick another. This can't be undone.",
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel & choose again',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            const { error: cancelError } = await supabase.rpc('cancel_unpaid_booking', {
              p_booking_id: booking.id,
            });
            setIsCancelling(false);

            if (cancelError) {
              Alert.alert('Could not cancel', cancelError.message);
              return;
            }

            router.replace(
              activityTypeId
                ? ({ pathname: '/booking-flow', params: { activityId: String(activityTypeId) } } as any)
                : ('/(home)' as any)
            );
          },
        },
      ]
    );
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
        <View style={{ width: contentWidth, gap: 14 }}>
          <Text style={FlowText.titleCentred}>Booking not found</Text>
          <Text style={styles.centredSubtitle}>{error || 'Could not load your booking.'}</Text>
          <FlowPillButton
            label="Go Back"
            width={contentWidth}
            onPress={() => router.push('/(home)')}
            style={{ marginTop: 8 }}
          />
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
        <View style={{ width: contentWidth, alignItems: 'center', gap: 14 }}>
          {/* The comp's tick rather than a lock emoji: this screen is now on
              the redesign, which draws its marks and never sets emoji. */}
          <Image
            source={TICK}
            style={styles.sealedTick}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Text style={FlowText.titleCentred}>
            {fullyCoveredByCredit ? 'Your invitation is sealed — on the house' : 'Your invitation is sealed'}
          </Text>
          <Text style={styles.centredSubtitle}>
            {fullyCoveredByCredit
              ? "A friend's invite made this one free. We'll let you know once your table is set."
              : discount > 0
                ? `A friend's invite covered ₹${discount} of this one. We'll let you know once your table is set.`
                : "We'll let you know once your table is set."}
          </Text>
          <FlowPillButton
            label="Continue  →"
            width={contentWidth}
            onPress={() => router.push('/(home)')}
            style={{ marginTop: 8 }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ width: contentWidth }}>
          <Text style={FlowText.titleCentred}>Unlock your adventure</Text>
          <Text style={styles.stepSubtitleCentred}>Complete your payment to confirm your spot</Text>

          {/* The booking, on the same card the flow's own summary step uses
              (UI PAGE 5) — this screen is the last thing a student sees before
              paying, so it should read as that step confirmed, not as a
              differently-drawn receipt. Nothing here is editable any more, so
              no row takes an onPress and none draws a chevron. */}
          <SummaryCard
            width={contentWidth}
            style={{ marginTop: 44 }}
            rows={[
              {
                icon:
                  activity?.name === 'Dinners'
                    ? SUMMARY_ICONS.dinners
                    : { source: activityArt(activity?.name), scale: ACTIVITY_ART_BADGE_SCALE },
                label: activity?.name ?? '',
              },
              {
                icon: SUMMARY_ICONS.slot,
                label: booking.slots?.slot_datetime
                  ? formatSlotDateTime(booking.slots.slot_datetime, activity?.name)
                  : '',
              },
              {
                icon: SUMMARY_ICONS.group,
                label: `Group of ${formatGroupSize(activity?.min_group_size ?? 4, activity?.max_group_size ?? 5)}`,
                detail: booking.plus_one ? `Bringing ${booking.plus_one_name}` : undefined,
              },
              {
                icon: SUMMARY_ICONS.money,
                label: `₹${fee}`,
                // A referral credit is the one thing that makes the figure
                // above differ from the sticker price, so it explains itself
                // on the row rather than in a line of its own.
                detail: discount > 0 ? `₹${stickerFee} − ₹${discount} referral credit` : undefined,
              },
            ]}
          />

          <View style={{ marginTop: 30, gap: 9 }}>
            <IncludedLine label="Matched with a compatible group" />
            <IncludedLine label="Venue revealed before the event" />
            {booking.plus_one && <IncludedLine label={`A seat for your +1, ${booking.plus_one_name}`} />}
          </View>

          {hasAttemptedPayment && booking.payment_status !== 'paid' && (
            <FlowSurfaceBox width={contentWidth} style={{ marginTop: 26 }}>
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>We haven&apos;t received your payment yet</Text>
                <Text style={styles.noticeBody}>
                  If you completed payment, give it a moment and check again.
                </Text>
              </View>
            </FlowSurfaceBox>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {isTestMode && (
            <FlowSurfaceBox width={contentWidth} style={{ marginTop: 26 }}>
              <View style={styles.notice}>
                <Text style={styles.noticeBody}>
                  Test mode: this is a simulated payment, no real money moves.
                </Text>
              </View>
            </FlowSurfaceBox>
          )}
        </View>
      </ScrollView>

      {/* Footer holds the same shape as every other flow screen: the quiet way
          out above the primary action, held clear of the device's safe area. */}
      <View
        style={{
          width: contentWidth,
          alignSelf: 'center',
          paddingBottom: 40 + insets.bottom,
          paddingTop: 12,
        }}>
        <FlowBackButton label="Maybe later" onPress={() => router.push('/(home)')} />

        <View style={{ marginTop: 18 }}>
          <FlowPillButton
            label={hasAttemptedPayment ? 'Try Again  →' : `Pay ₹${fee} to Unlock  →`}
            onPress={handlePay}
            loading={isProcessing}
            disabled={isCancelling}
            width={contentWidth}
          />
        </View>

        {hasAttemptedPayment && booking.payment_status !== 'paid' && (
          <Pressable
            onPress={handleCheckAgain}
            disabled={isProcessing || isCancelling}
            hitSlop={8}
            accessibilityRole="button"
            style={{ marginTop: 18 }}>
            <Text style={FlowText.link}>Check again</Text>
          </Pressable>
        )}

        <Pressable
          onPress={handleCancelAndChooseAgain}
          disabled={isProcessing || isCancelling}
          hitSlop={8}
          accessibilityRole="button"
          style={{ marginTop: 16 }}>
          {isCancelling ? (
            <ActivityIndicator size="small" color={Palette.error} />
          ) : (
            <Text style={styles.cancelLink}>Choose a different slot</Text>
          )}
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
    alignItems: 'center',
    // Same header drop as the booking flow's own steps, so moving from the
    // summary step to this screen doesn't shift the heading.
    paddingTop: 88,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  stepSubtitleCentred: {
    ...FlowText.subtitleItalic,
    marginTop: 2,
    textAlign: 'center',
  },
  centredSubtitle: {
    ...FlowText.subtitle,
    textAlign: 'center',
  },
  sealedTick: {
    width: 34,
    height: 34 * TICK_ASPECT,
    marginBottom: 6,
  },
  includedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 4,
  },
  includedTick: {
    width: 13,
    height: 13 * TICK_ASPECT,
  },
  includedLabel: {
    ...FlowText.fine,
    flex: 1,
  },
  notice: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 4,
  },
  noticeTitle: {
    ...FlowText.rowLabel,
  },
  noticeBody: {
    ...FlowText.fine,
  },
  error: {
    ...FlowText.error,
    marginTop: 20,
    paddingHorizontal: 8,
  },
  cancelLink: {
    color: Palette.error,
    fontSize: 14,
    textAlign: 'center',
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
});
