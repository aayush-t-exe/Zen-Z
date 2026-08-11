import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function BookingsScreen() {
  return (
    <ThemedView className="flex-1 items-center justify-center px-6">
      <View className="gap-4">
        <ThemedText type="title" className="text-xl">
          Your Events
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          No upcoming events yet. Book one to unlock your next adventure.
        </ThemedText>
      </View>
    </ThemedView>
  );
}
