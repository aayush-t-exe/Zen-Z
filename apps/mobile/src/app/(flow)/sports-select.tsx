import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';

interface SportOption {
  id: number;
  name: string;
  emoji: string;
}

const SPORT_ICONS: Record<string, any> = {
  'Box Cricket': require('@/assets/images/icon-cricket.png'),
  Football: require('@/assets/images/icon-football.png'),
  '8-Ball Pool': require('@/assets/images/icon-pool.png'),
  Pickleball: require('@/assets/images/icon-pickleball.png'),
};

const FRAME_RATIO = 1031 / 1195;

export default function SportsSelectScreen() {
  const router = useRouter();
  const { parentId } = useLocalSearchParams<{ parentId: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const [options, setOptions] = useState<SportOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const contentWidth = Math.min(480, screenWidth - 12);
  const cardGap = 16;
  const cardWidth = (contentWidth - cardGap) / 2;
  const cardHeight = cardWidth * FRAME_RATIO * 1.2;

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
    <View style={styles.root}>
      <View style={[styles.content, { width: contentWidth }]}>
        <View style={{ gap: 6 }}>
          <Text style={styles.title}>Enter the arena</Text>
          <Text style={styles.subtitle}>Four games, one Saturday. Choose wisely.</Text>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Palette.text} />
          </View>
        ) : options.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: cardGap }}>
            {options.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => handleSelect(option.id)}
                style={{ width: cardWidth, height: cardHeight }}>
                <Image
                  source={require('@/assets/images/card-frame.png')}
                  style={{ width: cardWidth, height: cardHeight }}
                  resizeMode="stretch"
                  accessibilityIgnoresInvertColors
                />
                <View style={[StyleSheet.absoluteFill, styles.cardContent]}>
                  <Image
                    source={SPORT_ICONS[option.name]}
                    style={styles.cardIcon}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                  <Text style={styles.cardTitle}>{option.name}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.subtitle}>No games available at the moment.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 32,
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    color: Palette.text,
    fontSize: 24,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: FontFamily.body.regular,
  },
  loading: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    width: 58,
    height: 58,
  },
  cardTitle: {
    color: Palette.text,
    fontSize: 19,
    fontWeight: '700',
    fontFamily: FontFamily.body.bold,
    textAlign: 'center',
  },
});
