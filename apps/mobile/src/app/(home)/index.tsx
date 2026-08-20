import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ImageSourcePropType,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

interface ActivityType {
  id: number;
  name: string;
  emoji: string;
  is_bookable: boolean;
}

const BANNER_RATIO = 730 / 1622;
const FRAME_RATIO = 1031 / 1195;

const ICONS: Record<string, ImageSourcePropType> = {
  Cafés: require('@/assets/images/icon-cafes.png'),
  Dinners: require('@/assets/images/icon-dinners.png'),
  Movies: require('@/assets/images/icon-movies.png'),
  Sports: require('@/assets/images/icon-sports.png'),
};

const taglineFor = (name: string) =>
  name === 'Movies' ? 'Unlock a seat' : name === 'Sports' ? 'Unlock a game' : 'Unlock a table';

export default function HomeScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [firstName, setFirstName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const contentWidth = Math.min(480, screenWidth - 12);
  const cardGap = 16;
  const cardWidth = (contentWidth - cardGap) / 2;

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

    const loadName = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (data?.full_name) setFirstName(data.full_name.trim().split(' ')[0]);
    };

    loadActivities();
    loadName();
  }, [user?.id]);

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
    <View style={styles.root}>
      <View style={[styles.content, { width: contentWidth }]}>
        <View style={{ gap: 6 }}>
          <Text style={styles.title}>{firstName ? `Welcome,\n${firstName}` : 'Welcome'}</Text>
          <Text style={styles.subtitle}>Pick an activity to unlock your next adventure.</Text>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Palette.text} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: cardGap }}>
            {activities.map((activity) => {
              const cardHeight = cardWidth * FRAME_RATIO * 1.2;
              return (
                <Pressable
                  key={activity.id}
                  onPress={() => handleActivityPress(activity)}
                  style={{ width: cardWidth, height: cardHeight }}>
                  <Image
                    source={require('@/assets/images/card-frame.png')}
                    style={{ width: cardWidth, height: cardHeight }}
                    resizeMode="stretch"
                    accessibilityIgnoresInvertColors
                  />
                  <View style={[StyleSheet.absoluteFill, styles.cardContent]}>
                    <Image
                      source={ICONS[activity.name]}
                      style={styles.cardIcon}
                      resizeMode="contain"
                      accessibilityIgnoresInvertColors
                    />
                    <Text style={styles.cardTitle}>{activity.name}</Text>
                    <Text style={styles.cardTagline}>{taglineFor(activity.name)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Image
          source={require('@/assets/images/home-match-banner.png')}
          style={{ width: contentWidth, height: contentWidth * BANNER_RATIO }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
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
    justifyContent: 'space-evenly',
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    color: Palette.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 21,
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
    textAlign: 'center',
  },
  cardTagline: {
    color: Palette.muted,
    fontSize: 14,
    textAlign: 'center',
  },
});
