import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ChatsScreen() {
  return (
    <ThemedView className="flex-1 items-center justify-center px-6">
      <View className="gap-4">
        <ThemedText type="title" className="text-xl">
          Group Chats
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          Once your group is matched, you'll chat here.
        </ThemedText>
      </View>
    </ThemedView>
  );
}
