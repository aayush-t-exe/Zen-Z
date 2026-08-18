import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

interface ActivityType {
  id: number;
  name: string;
  emoji: string;
  is_bookable: boolean;
}

const taglineFor = (name: string) =>
  name === 'Movies' ? 'Unlock a seat' : name === 'Sports' ? 'Enter the arena' : 'Unlock a table';

export default function HomeScreen() {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadActivities = async () => {
      const { data } = await supabase
        .from('activity_types')
        .select('id, name, emoji, is_bookable')
        .eq('is_live', true)
        .is('parent_activity_id', null)
        .order('id', { ascending: true });

      if (data) setActivities(data);
      setIsLoading(false);
    };

    loadActivities();
  }, []);

  const handleActivityPress = (activity: ActivityType) => {
    if (!activity.is_bookable) {
      router.push({
        pathname: '/sports-select' as any,
        params: { parentId: activity.id.toString() },
      });
      return;
    }

    router.push({
      pathname: '/booking-flow' as any,
      params: { activityId: activity.id.toString() },
    });
  };

  return (
    <ThemedView className="flex-1">
      <ScrollView className="flex-1 px-6 py-8" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="mb-8 gap-2">
          <ThemedText type="title" className="text-2xl">
            Ready for something?
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Pick an activity to unlock your next adventure.
          </ThemedText>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <View className="flex-1 gap-4">
            {activities.map((activity) => (
              <Pressable
                key={activity.id}
                onPress={() => handleActivityPress(activity)}
                className="flex-1 justify-center rounded-2xl bg-white px-6 dark:bg-gray-900"
              >
                <View className="gap-3">
                  <ThemedText className="text-4xl">{activity.emoji}</ThemedText>
                  <ThemedText className="text-lg font-semibold">
                    {activity.name}
                  </ThemedText>
                  <ThemedText type="default" themeColor="textSecondary" className="text-sm">
                    {taglineFor(activity.name)}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
