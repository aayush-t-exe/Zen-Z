import { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon, ActivityIcon } from '@/components/icon';
import { useTheme } from '@/hooks/use-theme';
import { fetchMyGroups, MyGroupDetails } from '@/lib/groups';
import { formatSlotDateTime } from '@/lib/format';

export default function ChatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [groups, setGroups] = useState<MyGroupDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        const data = await fetchMyGroups();
        if (!cancelled) {
          setGroups(data);
          setIsLoading(false);
        }
      };

      load();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1">
      <ScrollView className="flex-1 px-6 py-8">
        <ThemedText type="title" className="mb-6 text-xl">
          Group Chats
        </ThemedText>

        {groups.length === 0 ? (
          <ThemedText type="default" themeColor="textSecondary">
            Once your group is matched, you&apos;ll chat here.
          </ThemedText>
        ) : (
          <View className="gap-4">
            {groups.map((group) => (
              <Pressable
                key={group.group_id}
                onPress={() =>
                  router.push({
                    pathname: '/(home)/group/[groupId]',
                    params: { groupId: group.group_id },
                  })
                }
                className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <ActivityIcon iconKey={group.activity_icon_key} size={17} color={theme.text} />
                      <ThemedText className="font-semibold">{group.activity_name}</ThemedText>
                    </View>
                    <ThemedText type="default" themeColor="textSecondary" className="mt-1 text-sm">
                      {group.is_revealed
                        ? group.venue_name ?? formatSlotDateTime(group.slot_datetime)
                        : `Unlocks ${formatSlotDateTime(group.reveal_venue_at)}`}
                    </ThemedText>
                  </View>
                  <Icon name={group.is_revealed ? 'chat' : 'lock'} size={20} color={theme.textSecondary} />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
