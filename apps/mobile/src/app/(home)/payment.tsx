import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function PaymentScreen() {
  const router = useRouter();

  return (
    <ThemedView className="flex-1">
      <ScrollView className="flex-1 px-6 py-8">
        <View className="gap-6">
          <ThemedText type="title" className="text-2xl">
            Payment
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Razorpay payment integration coming in Milestone 12.
          </ThemedText>
          <ThemedText type="default" className="text-sm">
            For now, booking is confirmed and you'll be matched with a group.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
