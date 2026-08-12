import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

interface BookingDetails {
  id: string;
  user_id: string;
  status: string;
  slots: any;
}

export default function PaymentScreen() {
  const router = useRouter();
  const { slotId } = useLocalSearchParams<{ slotId: string }>();

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (slotId) {
      fetchBooking();
    }
  }, [slotId]);

  const fetchBooking = async () => {
    try {
      // Get the latest booking for this slot
      const { data, error: fetchError } = await supabase
        .from('bookings')
        .select(`
          id,
          user_id,
          status,
          slots:slot_id (
            activity_type_id,
            activity_types:activity_type_id (
              name,
              emoji,
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
    } catch (err) {
      console.error('Error fetching booking:', err);
      setError('Failed to load booking');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePaymentOrder = async () => {
    if (!booking) {
      setError('Booking not found');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Call the create-payment-order Edge Function
      const { data, error: functionError } = await supabase.functions.invoke(
        'create-payment-order',
        {
          body: {
            bookingId: booking.id,
          },
        }
      );

      if (functionError) {
        setError(functionError.message || 'Failed to create payment order');
        setIsProcessing(false);
        return;
      }

      if (!data.success) {
        setError(data.error || 'Failed to create payment order');
        setIsProcessing(false);
        return;
      }

      // For now, show the order details
      // TODO: Integrate Razorpay checkout SDK in next phase
      Alert.alert(
        'Order Created',
        `Order ID: ${data.order_id}\nAmount: ₹${data.amount}\n\nRazorpay checkout integration coming soon.`,
        [
          {
            text: 'Continue to Matches',
            onPress: () => {
              // Navigate to waiting/matches screen
              router.push('/(home)');
            },
          },
        ]
      );
    } catch (err: any) {
      setError(err.message || 'Payment error');
    } finally {
      setIsProcessing(false);
    }
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
            <ThemedText className="text-center font-semibold text-black">
              Go Back
            </ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const activity = booking.slots?.activity_types;
  const fee = activity?.convenience_fee || 9;

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
                <ThemedText className="text-5xl">
                  {activity?.emoji}
                </ThemedText>
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
                    ✓ Spot reserved in group of 4–5
                  </ThemedText>
                  <ThemedText type="default" themeColor="textSecondary" className="text-sm">
                    ✓ Matched with compatible group
                  </ThemedText>
                  <ThemedText type="default" themeColor="textSecondary" className="text-sm">
                    ✓ Venue revealed before event
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          {error && (
            <ThemedText type="default" className="text-red-500">
              {error}
            </ThemedText>
          )}

          {/* Test Mode Notice */}
          <View className="rounded-lg bg-yellow-50 px-4 py-3 dark:bg-yellow-900/20">
            <ThemedText type="default" className="text-xs text-yellow-800 dark:text-yellow-200">
              Test mode: Add Razorpay credentials to enable live payments
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      {/* Payment Button */}
      <View className="gap-3 px-6 pb-8">
        <Pressable
          onPress={handleCreatePaymentOrder}
          disabled={isProcessing}
          className="rounded-lg bg-white py-3 px-4 disabled:opacity-50"
        >
          {isProcessing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <ThemedText className="text-center font-semibold text-black">
              Pay ₹{fee} to Unlock →
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
