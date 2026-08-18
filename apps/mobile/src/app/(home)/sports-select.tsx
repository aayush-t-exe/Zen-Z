import { useState, useCallback } from 'react';
import { View, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

interface SportOption {
  id: number;
  name: string;
  emoji: string;
}

export default function SportsSelectScreen() {
  const router = useRouter();
  const { parentId } = useLocalSearchParams<{ parentId: string }>();
  const [options, setOptions] = useState<SportOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadOptions = async () => {
        setIsLoading(true);
        const { data } = await supabase
          .from('activity_types')
          .select('id, name, emoji')
          .eq('parent_activity_id', parseInt(parentId || '0'))
          .eq('is_live', true)
          .order('id', { ascending: true });

        if (data) setOptions(data);
        setIsLoading(false);
      };

      loadOptions();
    }, [parentId])
  );

  const handleSelect = (optionId: number) => {
    router.push({
      pathname: '/booking-flow' as any,
      params: { activityId: optionId.toString() },
    });
  };

  return (
    <ThemedView className="flex-1">
      <ScrollView className="flex-1 px-6 py-8">
        <View className="mb-6 gap-2">
          <ThemedText type="title" className="text-2xl">
            Enter the arena
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            Four games, one Saturday. Choose wisely.
          </ThemedText>
        </View>

        {isLoading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" />
          </View>
        ) : options.length > 0 ? (
          <View className="gap-4">
            {options.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => handleSelect(option.id)}
                className="rounded-2xl bg-white px-6 py-5 dark:bg-gray-900"
              >
                <View className="flex-row items-center gap-3">
                  <ThemedText className="text-3xl">{option.emoji}</ThemedText>
                  <ThemedText className="text-lg font-semibold">{option.name}</ThemedText>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <ThemedText type="default" themeColor="textSecondary">
            No games available at the moment.
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}
