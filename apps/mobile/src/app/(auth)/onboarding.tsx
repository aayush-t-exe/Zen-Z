import { useState, useRef } from 'react';
import { View, Pressable, FlatList, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const ONBOARDING_SCREENS = [
  {
    id: '1',
    title: 'Every table has a story',
    subtitle: 'before anyone sits down.',
  },
  {
    id: '2',
    title: 'We craft your group.',
    subtitle: 'You just show up.',
  },
  {
    id: '3',
    title: 'No swiping.',
    subtitle: 'Just an invitation.',
  },
];

const screenWidth = Dimensions.get('window').width;

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < ONBOARDING_SCREENS.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    } else {
      router.push('/(auth)/email-input');
    }
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / screenWidth);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  };

  const renderScreen = ({ item }: { item: typeof ONBOARDING_SCREENS[0] }) => (
    <View style={{ width: screenWidth }} className="flex-1 items-center justify-center px-6">
      <View className="gap-3">
        <ThemedText type="title" className="text-center text-3xl font-bold">
          {item.title}
        </ThemedText>
        {item.subtitle && (
          <ThemedText type="default" className="text-center text-lg">
            {item.subtitle}
          </ThemedText>
        )}
      </View>
    </View>
  );

  return (
    <ThemedView className="flex-1">
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SCREENS}
        renderItem={renderScreen}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />

      <View className="flex-row items-center justify-between gap-4 px-6 pb-8">
        <View className="flex-row gap-2">
          {ONBOARDING_SCREENS.map((_, idx) => (
            <View
              key={idx}
              className={`h-2 rounded-full ${
                idx === currentIndex ? 'w-8 bg-white' : 'w-2 bg-gray-500'
              }`}
            />
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          className="flex-1 rounded-lg bg-white py-3 px-4"
        >
          <ThemedText className="text-center font-semibold text-black">
            {currentIndex === ONBOARDING_SCREENS.length - 1 ? 'Begin →' : 'Next →'}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}
