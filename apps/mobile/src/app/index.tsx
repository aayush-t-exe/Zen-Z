import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ScaffoldCheck() {
  return (
    <ThemedView className="flex-1 items-center justify-center">
      <View className="items-center gap-2">
        <ThemedText type="title">campus-social</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Mobile scaffold ready — real screens start at Milestone 7.
        </ThemedText>
      </View>
    </ThemedView>
  );
}
