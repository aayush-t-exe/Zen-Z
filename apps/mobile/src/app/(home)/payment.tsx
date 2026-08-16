import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon, ActivityIcon } from '@/components/icon';
import { useTheme } from '@/hooks/use-theme';
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

export default function PaymentScreen() {
  const theme = useTheme();
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
              icon_key,
              convenience_fee
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
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!booking) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <View className="gap-4">
          <ThemedText type="title" className="text-xl">
            Booking Not Found
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            {error || 'Could not load your booking.'}
          </ThemedText>
          <Pressable
            onPress={() => router.push('/(home)')}
            className="rounded-lg bg-white py-3 px-4"
          >
            <ThemedText themeColor="onLight" className="text-center font-semibold">
              Go Back
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const activity = booking.slots?.activity_types;
  const fee = activity?.convenience_fee || 21;

  if (booking.payment_status === 'paid') {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <View className="items-center gap-4">
          <Icon name="lock" size={46} color={theme.text} weight={2.2} />
          <ThemedText type="title" className="text-center text-2xl">
            Your invitation is sealed
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" className="text-center">
            We&apos;ll let you know once your table is set.
          </ThemedText>
          <Pressable
            onPress={() => router.push('/(home)')}
            className="mt-4 rounded-lg bg-white px-6 py-3"
          >
            <ThemedText themeColor="onLight" className="text-center font-semibold">
              Continue
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1">
      <ScrollView className="flex-1 px-6 py-8">
        <View className="gap-6">
          <View className="gap-2">
            <ThemedText type="title" className="text-2xl">
              Unlock Your Adventure
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              Complete your payment to confirm your spot
            </ThemedText>
          </View>

          {/* Order Summary */}
          <View className="rounded-2xl bg-white px-6 py-8 dark:bg-gray-900">
            <View className="gap-6">
              <View className="gap-3 items-center">
                <ActivityIcon iconKey={activity?.icon_key ?? 'cafe'} size={46} color={theme.text} weight={2.2} />
                <ThemedText className="text-lg font-semibold">
                  {activity?.name}
                </ThemedText>
              </View>

              {/* Amount */}
              <View className="border-t border-gray-300 pt-6 dark:border-gray-700">
                <ThemedText type="default" themeColor="textSecondary" className="text-xs">
                  Convenience fee
                </ThemedText>
                <ThemedText className="text-3xl font-bold">
                  ₹{fee}
                </ThemedText>
              </View>

              {/* What's included */}
              <View className="gap-2 border-t border-gray-300 pt-4 dark:border-gray-700">
                <ThemedText type="default" className="text-sm font-semibold">
                  Your unlock includes:
                </ThemedText>
                <View className="gap-2">
                  <ThemedText type="default" themeColor="textSecondary" className="text-sm">
                    Spot reserved in group of 4–5
                  </ThemedText>
                  <ThemedText type="default" themeColor="textSecondary" className="text-sm">
                    Matched with compatible group
                  </ThemedText>
                  <ThemedText type="default" themeColor="textSecondary" className="text-sm">
                    Venue revealed before event
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          {hasAttemptedPayment && booking.payment_status !== 'paid' && (
            <View className="rounded-lg border border-gray-300 px-4 py-3 dark:border-gray-600">
              <ThemedText type="default" className="text-sm font-semibold">
                We haven&apos;t received your payment yet
              </ThemedText>
              <ThemedText type="default" themeColor="textSecondary" className="mt-1 text-sm">
                If you completed payment, give it a moment and check again.
              </ThemedText>
            </View>
          )}

          {error && (
            <ThemedText type="default" themeColor="error">
              {error}
            </ThemedText>
          )}

          {isTestMode && (
            <View className="rounded-lg bg-yellow-50 px-4 py-3 dark:bg-yellow-900/20">
              <ThemedText type="default" themeColor="warning" className="text-xs">
                Test mode: this is a simulated Razorpay payment, no real money moves.
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Payment Button */}
      <View className="gap-3 px-6 pb-8">
        {hasAttemptedPayment && booking.payment_status !== 'paid' && (
          <Pressable
            onPress={handleCheckAgain}
            disabled={isProcessing}
            className="rounded-lg border border-gray-300 py-3 px-4 dark:border-gray-600"
          >
            <ThemedText className="text-center font-semibold">Check Again</ThemedText>
          </Pressable>
        )}

        <Pressable
          onPress={handlePay}
          disabled={isProcessing}
          className="rounded-lg bg-white py-3 px-4 disabled:opacity-50"
        >
          {isProcessing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <ThemedText themeColor="onLight" className="text-center font-semibold">
              {hasAttemptedPayment ? 'Try Again' : `Pay ₹${fee} to Unlock`}
            </ThemedText>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push('/(home)')}
          disabled={isProcessing}
          className="rounded-lg border border-gray-300 py-3 px-4 dark:border-gray-600"
        >
          <ThemedText className="text-center font-semibold">
            Maybe Later
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}
