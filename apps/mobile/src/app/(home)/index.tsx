import { View, Pressable, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const ACTIVITIES = [
  {
    id: 'cafes',
    emoji: '☕',
    name: 'Cafés',
    tagline: 'Unlock a table',
  },
  {
    id: 'dinners',
    emoji: '🍽',
    name: 'Dinners',
    tagline: 'Unlock a table',
  },
  {
    id: 'movies',
    emoji: '🎬',
    name: 'Movies',
    tagline: 'Unlock a seat',
  },
];

export default function HomeScreen() {
  const handleActivityPress = (activityId: string) => {
    // TODO: Navigate to booking flow in Milestone 11
    console.log(`Booking flow for ${activityId} - coming in Milestone 11`);
  };

  return (
    <ThemedView className="flex-1">
      <ScrollView className="flex-1 px-6 py-8">
        <View className="mb-8 gap-2">
          <ThemedText type="title" className="text-2xl">
            Ready for something?
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Pick an activity to unlock your next adventure.
          </ThemedText>
        </View>

        <View className="gap-4">
          {/* Row 1: Cafés and Dinners */}
          <View className="flex-row gap-4">
            {ACTIVITIES.slice(0, 2).map((activity) => (
              <Pressable
                key={activity.id}
                onPress={() => handleActivityPress(activity.id)}
                className="flex-1 rounded-2xl bg-white px-6 py-8 dark:bg-gray-900"
              >
                <View className="gap-3">
                  <ThemedText className="text-4xl">
                    {activity.emoji}
                  </ThemedText>
                  <ThemedText className="text-lg font-semibold">
                    {activity.name}
                  </ThemedText>
                  <ThemedText type="default" themeColor="textSecondary" className="text-sm">
                    {activity.tagline}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Row 2: Movies */}
          <View>
            <Pressable
              onPress={() => handleActivityPress(ACTIVITIES[2].id)}
              className="rounded-2xl bg-white px-6 py-8 dark:bg-gray-900"
            >
              <View className="gap-3">
                <ThemedText className="text-4xl">
                  {ACTIVITIES[2].emoji}
                </ThemedText>
                <ThemedText className="text-lg font-semibold">
                  {ACTIVITIES[2].name}
                </ThemedText>
                <ThemedText type="default" themeColor="textSecondary" className="text-sm">
                  {ACTIVITIES[2].tagline}
                </ThemedText>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}
