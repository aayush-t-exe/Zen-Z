import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Modal,
  StyleSheet,
  Alert,
  Platform,
  BackHandler,
  useWindowDimensions,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { ACTIVITY_ART_BADGE_SCALE, activityArt } from '@/constants/activity-art';
import { FLOW_CONTENT_MAX, FLOW_SIDE_PADDING, FlowSurface, FlowText } from '@/constants/flow-theme';
import { FlowSurfaceBox } from '@/components/flow-panel';
import { FlowPillButton } from '@/components/flow-pill-button';
import { SUMMARY_ICONS, SummaryCard } from '@/components/summary-card';
import { supabase } from '@/lib/supabase';
import { formatSlotDateTime } from '@/lib/format';
import { buildWhatsappUrl, fetchSupportEmail, fetchSupportWhatsappPhone } from '@/lib/support';
import { fetchProfileFields } from '@/lib/profile';

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
  movie_choice_type: string | null;
  movie: any;
  slots: any;
}

const PAYMENT_POLL_ATTEMPTS = 5;
const PAYMENT_POLL_DELAY_MS = 1500;

/** Side margin the book-again confirm dialog sits within — same as bookings.tsx's remove-booking dialog. */
const CONFIRM_OVERLAY_PADDING = 28;
/** Confirm dialog's own inset, on all four sides. */
const CONFIRM_CARD_PADDING = 24;

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
  const { slotId, resumed } = useLocalSearchParams<{ slotId: string; resumed?: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);
  // The confirm dialog sits narrower than the page column, on its own margin.
  const confirmCardWidth = Math.min(320, screenWidth - CONFIRM_OVERLAY_PADDING * 2);

  // This screen is reached two different ways — pushed on top of
  // booking-flow.tsx for a fresh booking, or *replacing* it outright when
  // there's already a pending booking for that slot (see the existingBooking
  // branch this screen's caller uses) — so the back stack underneath it
  // isn't always the same depth. Android's hardware back button defaults to
  // popping that stack directly, and with nothing left under it that pop
  // closes the app to the home screen instead of landing anywhere in Zen-Z.
  // Pushing to home explicitly (not `back()`) keeps the hardware button
  // behaving the same regardless of how this screen was reached.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      router.push('/(home)');
      return true;
    });
    return () => subscription.remove();
  }, [router]);

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showBookAgainConfirm, setShowBookAgainConfirm] = useState(false);
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
          movie_choice_type,
          movie:movie_id ( title, price ),
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

  // The web checkout runs in its own tab (or, from an installed home-screen
  // app, in Safari), so coming back from it never fires navigation focus —
  // this screen was never unfocused. The document just becomes visible
  // again. Refetching on that is what actually turns the screen green after
  // a payment, and it's the only path back: PayU's Payment Links don't
  // redirect, so nothing else tells the app anything happened.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }
    const refetchIfVisible = () => {
      if (document.visibilityState === 'visible' && slotId) {
        fetchBooking();
      }
    };
    document.addEventListener('visibilitychange', refetchIfVisible);
    return () => document.removeEventListener('visibilitychange', refetchIfVisible);
  }, [slotId, fetchBooking]);

  const handlePay = async () => {
    if (!booking) {
      setError('Booking not found');
      return;
    }

    // Opened blank, synchronously, before the awaited call below: Safari
    // only allows window.open from inside the tap itself and blocks it once
    // a network round trip has happened, which is the same restriction that
    // ruled out WebBrowser's popup-based web shim. It gets pointed at PayU
    // once the link comes back.
    const checkoutTab = Platform.OS === 'web' ? window.open('', '_blank') : null;

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
        checkoutTab?.close();
        return;
      }

      if (!data.success) {
        setError(data.error || 'Failed to create payment link');
        checkoutTab?.close();
        return;
      }

      setIsTestMode(!!data.is_test_mode);

      if (Platform.OS === 'web') {
        // Checkout goes to its own tab so this one survives. Navigating
        // this tab to PayU instead (which is what shipped first) tore the
        // app down mid-payment, and since PayU's Payment Links never
        // redirect back (see create-payment-order's own note on that), the
        // student was simply left on PayU's "Payment Completed" page with
        // no way back and nothing left running to notice they had paid.
        //
        // No poll here the way the native path does below: the student is
        // in the other tab and will be for a while, so there'd be nothing
        // to see yet. The visibilitychange refetch above is what picks this
        // up when they come back.
        if (checkoutTab) {
          checkoutTab.location.href = data.payment_link_url;
          return;
        }
        // Popup blocked. Falling back to the old behaviour rather than
        // stranding the payment entirely — the webhook still marks the
        // booking paid, the student just has to find their own way back.
        window.location.href = data.payment_link_url;
        return;
      }

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
      checkoutTab?.close();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckAgain = async () => {
    setIsProcessing(true);
    await fetchBooking();
    setIsProcessing(false);
  };

  // A stuck "we haven't received your payment yet" is exactly where a
  // student who did pay has no self-service way forward — Check Again
  // only re-reads this same booking row (see fetchBooking above), so if
  // the webhook never lands it can never recover on its own. WhatsApp
  // over a plain call: async, and the student can attach their payment
  // screenshot — see profiles.phone's own doc comment on why WhatsApp is
  // this app's established contact channel, not calling.
  const [isContactingSupport, setIsContactingSupport] = useState(false);

  const handleContactSupport = async () => {
    if (isContactingSupport || !booking) return;
    setIsContactingSupport(true);

    try {
      const phone = await fetchSupportWhatsappPhone();
      if (!phone) {
        const email = await fetchSupportEmail();
        Alert.alert(
          "Couldn't open WhatsApp",
          email
            ? `Please email us at ${email} instead.`
            : "We couldn't load our contact details right now. Please try again in a moment."
        );
        return;
      }

      const activityName = booking.slots?.activity_types?.name ?? 'my booking';
      const name = await fetchProfileFields(booking.user_id).then((p) => p.full_name, () => null);
      const message = `Hi, I'm ${name ?? 'a student'} and I paid for ${activityName} but the app still shows payment not received. Booking ID: ${booking.id}`;
      await Linking.openURL(buildWhatsappUrl(phone, message));
    } catch (err) {
      console.error('Failed to open WhatsApp:', err);
      Alert.alert("Couldn't open WhatsApp", 'Please try again in a moment.');
    } finally {
      setIsContactingSupport(false);
    }
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
    setShowBookAgainConfirm(true);
  };

  const handleConfirmBookAgain = async () => {
    if (!booking) return;
    const activityTypeId = booking.slots?.activity_type_id;

    setShowBookAgainConfirm(false);
    setIsCancelling(true);
    const { error: cancelError } = await supabase.rpc('cancel_unpaid_booking', {
      p_booking_id: booking.id,
    });
    setIsCancelling(false);

    if (cancelError) {
      Alert.alert('Could not restart your booking', cancelError.message);
      return;
    }

    router.replace(
      activityTypeId
        ? ({ pathname: '/booking-flow', params: { activityId: String(activityTypeId) } } as any)
        : ('/(home)' as any)
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
  // A choose_movie booking prices against that specific title (a new
  // release can cost more than the usual flat fee, see
  // 0088_movie_price.sql) — surprise_me pays the flat activity fee since
  // it never learns which movie it'll get until the founder assigns one
  // post-match. This must exactly match how create-payment-order (the
  // Edge Function that actually charges PayU) derives its own amount, or
  // this screen would show one figure while a different one gets charged.
  const baseFee =
    booking.movie_choice_type === 'choose_movie' && booking.movie
      ? booking.movie.price
      : activity?.convenience_fee || 21;
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
          {resumed === '1' && (
            // Only shown when this screen was reached by re-tapping an
            // already-sealed activity (booking-flow.tsx's existingBooking
            // redirect), not right after actually paying — a student who
            // just paid already knows why they're seeing this.
            <Text style={styles.resumedNote}>
              You&apos;ve already unlocked {activity?.name ?? 'this'} for the week — that&apos;s this
              invitation, not a new one.
            </Text>
          )}
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
                detail: booking.movie_choice_type
                  ? booking.movie_choice_type === 'choose_movie'
                    ? booking.movie?.title
                    : 'Surprise me'
                  : undefined,
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
            {activity?.name === 'Movies' && (
              <IncludedLine label="Movie tickets shared one day before the event" />
            )}
            {booking.plus_one && <IncludedLine label={`A seat for your +1, ${booking.plus_one_name}`} />}
          </View>

          {hasAttemptedPayment && booking.payment_status !== 'paid' && (
            <FlowSurfaceBox width={contentWidth} style={{ marginTop: 26 }}>
              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>We haven&apos;t received your payment yet</Text>
                <Text style={styles.noticeBody}>
                  If you completed payment, give it a moment and check again. Still stuck? Message us
                  and we&apos;ll sort it out.
                </Text>
                <Pressable
                  onPress={handleContactSupport}
                  disabled={isContactingSupport}
                  hitSlop={8}
                  accessibilityRole="button"
                  style={{ marginTop: 10 }}>
                  <Text style={FlowText.link}>
                    {isContactingSupport ? 'Opening WhatsApp…' : 'Message us on WhatsApp'}
                  </Text>
                </Pressable>
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

      {/* Footer: payment is mandatory to hold the slot, so this is just the
          primary action, held clear of the device's safe area — no
          skip-for-now option. */}
      <View
        style={{
          width: contentWidth,
          alignSelf: 'center',
          paddingBottom: 40 + insets.bottom,
          paddingTop: 12,
        }}>
        <FlowPillButton
          label={hasAttemptedPayment ? 'Try Again  →' : `Pay ₹${fee} to Unlock  →`}
          onPress={handlePay}
          loading={isProcessing}
          disabled={isCancelling}
          width={contentWidth}
        />

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
            <ActivityIndicator size="small" color={Palette.muted} />
          ) : (
            <Text style={styles.cancelLink}>Not quite right? Book again</Text>
          )}
        </Pressable>
      </View>

      <Modal
        visible={showBookAgainConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBookAgainConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, { width: confirmCardWidth }]}>
            <Text style={styles.confirmTitle}>Book again?</Text>
            <Text style={styles.confirmMessage}>
              You haven&apos;t paid yet, so nothing&apos;s booked — but you&apos;ll give up this spot
              to redo your booking (slot, budget, group), and can&apos;t get it back.
            </Text>
            <View style={styles.confirmActions}>
              <FlowPillButton
                label="Keep this spot"
                width={confirmCardWidth - CONFIRM_CARD_PADDING * 2}
                onPress={() => setShowBookAgainConfirm(false)}
                disabled={isCancelling}
              />
              <Pressable
                onPress={handleConfirmBookAgain}
                disabled={isCancelling}
                style={styles.confirmRemoveButton}
                hitSlop={8}
              >
                {isCancelling ? (
                  <ActivityIndicator size="small" color={Palette.error} />
                ) : (
                  <Text style={styles.confirmRemoveText}>Yes, book again</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  resumedNote: {
    ...FlowText.fine,
    textAlign: 'center',
    marginTop: 4,
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
    color: Palette.muted,
    fontSize: 14,
    textAlign: 'center',
    textDecorationLine: 'underline',
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
