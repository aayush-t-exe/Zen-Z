import { useCallback, useEffect, useState } from 'react';
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
import { FontFamily } from '@/constants/fonts';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { AuthButton } from '@/components/auth-button';

interface ActivityType {
  id: number;
  name: string;
  emoji: string;
  is_bookable: boolean;
}

const BANNER_RATIO = 737 / 1625;
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const contentWidth = Math.min(480, screenWidth - 12);
  const cardGap = 16;
  const cardWidth = (contentWidth - cardGap) / 2;

  const loadActivities = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    const { data, error } = await supabase
      .from('activity_types')
      .select('id, name, emoji, is_bookable')
      .eq('is_live', true)
      .is('parent_activity_id', null)
      .order('id', { ascending: true });

    if (error) {
      setLoadError(error.message);
      setIsLoading(false);
      return;
    }

    if (data) setActivities(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const loadName = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (data?.full_name) setFirstName(data.full_name.trim().split(' ')[0]);
    };

    // loadActivities is a stable useCallback so this only ever runs
    // once per user id, same as before it was hoisted out to also be
    // reachable from the Retry button below — not the repeated-render
    // loop this lint rule guards against (same reasoning as
    // network-status-overlay.tsx's identical suppression).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadActivities();
    loadName();
  }, [user?.id, loadActivities]);

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
        ) : loadError ? (
          <View style={styles.loading}>
            <Text style={[styles.subtitle, { textAlign: 'center' }]}>
              Couldn&apos;t load activities. {loadError}
            </Text>
            <View style={{ marginTop: 16, width: contentWidth }}>
              <AuthButton label="Retry" onPress={loadActivities} loading={isLoading} />
            </View>
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

        {/* Replaces the earlier banner, which had "Match of the Week!" baked
            into the art — didn't fit a founder-matched-groups product. This
            one's own baked-in "Ready to meet" headline already reads right,
            so unlike the previous version there's no separate text overlay
            here to keep in sync with the art. */}
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
    justifyContent: 'center',
    gap: 36,
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    color: Palette.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
    letterSpacing: -0.6,
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
  cardTagline: {
    color: Palette.muted,
    fontSize: 14,
    fontFamily: FontFamily.body.regular,
    textAlign: 'center',
  },
});
