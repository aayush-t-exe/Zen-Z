import { useEffect, useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActivityIcon } from '@/components/icon';
import { Card } from '@/components/surface';
import { Loader } from '@/components/loader';
import { ActivityColor, ActivityInk, Palette } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

interface ActivityType {
  id: number;
  name: string;
  icon_key: string;
}

const taglineFor = (name: string) => (name === 'Movies' ? 'Unlock a seat' : 'Unlock a table');

export default function HomeScreen() {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadActivities = async () => {
      const { data } = await supabase
        .from('activity_types')
        .select('id, name, icon_key')
        .eq('is_live', true)
        .order('id', { ascending: true });

      if (data) setActivities(data);
      setIsLoading(false);
    };

    loadActivities();
  }, []);

  const handleActivityPress = (activityId: number) => {
    router.push({
      pathname: '/booking-flow' as any,
      params: { activityId: activityId.toString() },
    });
  };

  return (
    <ThemedView className="flex-1">
      <ScrollView className="flex-1 px-6 py-8" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="mb-8 gap-2">
          <ThemedText type="title">Ready for something?</ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Pick an activity to unlock your next adventure.
          </ThemedText>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Loader label="Finding this week" />
          </View>
        ) : (
          <View className="flex-1 gap-4">
            {activities.map((activity) => {
              // Each activity owns one hue. The card is that hue, which is
              // why the screen never shows more than two accents at once.
              const fill = ActivityColor[activity.icon_key] ?? Palette.marigold;
              const ink = ActivityInk[activity.icon_key] ?? Palette.ink;

              return (
                <Pressable
                  key={activity.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${activity.name}. ${taglineFor(activity.name)}`}
                  onPress={() => handleActivityPress(activity.id)}
                  className="flex-1"
                >
                  <Card fill={fill} padding={20} style={{ flex: 1, justifyContent: 'center' }}>
                    <View className="flex-row items-center gap-4">
                      <ActivityIcon iconKey={activity.icon_key} size={38} color={ink} weight={2.4} />
                      <View className="flex-1 gap-1">
                        <ThemedText type="subtitle" style={{ color: ink }}>
                          {activity.name}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: ink, opacity: 0.75 }}>
                          {taglineFor(activity.name)}
                        </ThemedText>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}
