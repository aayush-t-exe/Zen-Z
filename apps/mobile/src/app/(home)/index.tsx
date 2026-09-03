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
import { FlowPillButton } from '@/components/flow-pill-button';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

interface ActivityType {
  id: number;
  name: string;
  emoji: string;
  is_bookable: boolean;
}

/**
 * Geometry measured off the approved comp (Desktop/UI/UI PAGE 1/"gen z ui
 * black.jpg.jpeg"). That file is 1170x2532 — a 390pt screen at @3x — so every
 * comp pixel divides by 3 to give the dp value used here. Ratios rather than
 * fixed dp wherever something should track the card/banner as the screen
 * width changes.
 */
const SIDE_PADDING = 21; // comp 64px
const CARD_COLUMN_GAP = 13; // comp 38px
const CARD_ROW_GAP = 33; // comp 98px — notably wider than the column gap
const CARD_TO_BANNER_GAP = 42; // comp 126px
const CARD_RATIO = 476 / 504; // card height / card width
const BADGE_RATIO = 245 / 504; // badge diameter / card width
const ICON_RATIO = 0.7; // activity icon / badge diameter
const BADGE_TOP_RATIO = 8.3 / 168; // badge inset from card top / card width
const TITLE_GAP_RATIO = 19.1 / 168; // badge-to-title gap / card width
const BANNER_RATIO = 488 / 1046; // banner height / banner width
// Illustration placement, taken from its keyed-out bounds inside the comp's
// banner box: flush with the banner's bottom edge, a hair in from the right.
const PEOPLE_W_RATIO = 0.4761; // of banner width
const PEOPLE_H_RATIO = 0.8299; // of banner height
const PEOPLE_RIGHT_RATIO = 0.0229; // of banner width
const BANNER_TEXT_LEFT_RATIO = 84 / 1046; // text inset / banner width
const BANNER_TEXT_TOP_RATIO = 0.164; // text block top / banner height

const ICONS: Record<string, ImageSourcePropType> = {
  Cafés: require('@/assets/images/icon-cafes-photo.png'),
  Dinners: require('@/assets/images/icon-dinners-photo.png'),
  Movies: require('@/assets/images/icon-movies-photo.png'),
  Sports: require('@/assets/images/icon-sports-photo.png'),
};

const taglineFor = (name: string) =>
  name === 'Movies'
    ? 'Unlock Your Seat'
    : name === 'Sports'
      ? 'Unlock Your Game'
      : 'Unlock Your Table';

export default function HomeScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const user = useAuthStore((state) => state.user);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [firstName, setFirstName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const contentWidth = Math.min(480, screenWidth - SIDE_PADDING * 2);
  const cardWidth = (contentWidth - CARD_COLUMN_GAP) / 2;
  const cardHeight = cardWidth * CARD_RATIO;
  const badgeSize = cardWidth * BADGE_RATIO;
  const iconSize = badgeSize * ICON_RATIO;
  const bannerHeight = contentWidth * BANNER_RATIO;

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
          <Text style={styles.title}>{firstName ? `Welcome\n${firstName}` : 'Welcome'}</Text>
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
              <FlowPillButton label="Retry" width={contentWidth} onPress={loadActivities} loading={isLoading} />
            </View>
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              columnGap: CARD_COLUMN_GAP,
              rowGap: CARD_ROW_GAP,
              marginTop: 40,
            }}>
            {activities.map((activity) => (
              <Pressable
                key={activity.id}
                onPress={() => handleActivityPress(activity)}
                style={{ width: cardWidth, height: cardHeight }}>
                <Image
                  source={require('@/assets/images/home-card-frame.png')}
                  style={{ width: cardWidth, height: cardHeight }}
                  resizeMode="stretch"
                  accessibilityIgnoresInvertColors
                />
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { alignItems: 'center', paddingTop: cardWidth * BADGE_TOP_RATIO },
                  ]}>
                  <View
                    style={{
                      width: badgeSize,
                      height: badgeSize,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {/* Both of these need explicit width/height: an <Image>
                        given StyleSheet.absoluteFill ignores it and lays out
                        at its intrinsic pixel size instead, which rendered
                        this badge at 700dp — several times the screen width. */}
                    <Image
                      source={require('@/assets/images/home-icon-badge.png')}
                      style={{ position: 'absolute', width: badgeSize, height: badgeSize }}
                      resizeMode="contain"
                      accessibilityIgnoresInvertColors
                    />
                    <Image
                      source={ICONS[activity.name]}
                      style={{ width: iconSize, height: iconSize }}
                      resizeMode="contain"
                      accessibilityIgnoresInvertColors
                    />
                  </View>
                  <Text style={[styles.cardTitle, { marginTop: cardWidth * TITLE_GAP_RATIO }]}>
                    {activity.name}
                  </Text>
                  <Text style={styles.cardTagline}>{taglineFor(activity.name)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <View
          style={{ width: contentWidth, height: bannerHeight, marginTop: CARD_TO_BANNER_GAP }}>
          <Image
            source={require('@/assets/images/home-banner-panel.png')}
            style={{ position: 'absolute', width: contentWidth, height: bannerHeight }}
            resizeMode="stretch"
            accessibilityIgnoresInvertColors
          />
          <Image
            source={require('@/assets/images/home-banner-people.png')}
            style={{
              position: 'absolute',
              right: contentWidth * PEOPLE_RIGHT_RATIO,
              bottom: 0,
              width: contentWidth * PEOPLE_W_RATIO,
              height: bannerHeight * PEOPLE_H_RATIO,
            }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <View
            style={[
              styles.bannerText,
              {
                left: contentWidth * BANNER_TEXT_LEFT_RATIO,
                paddingTop: bannerHeight * BANNER_TEXT_TOP_RATIO,
              },
            ]}
            pointerEvents="none">
            <Text style={styles.bannerHeadline}>Ready to meet</Text>
            <Text style={styles.bannerSubtitle}>New people. New stories.{'\n'}New memories.</Text>
          </View>
        </View>
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
    paddingTop: 24,
    // The floating pill tab bar (home/_layout.tsx) is position: 'absolute'
    // now instead of docked, so this screen has to reserve the space itself
    // (bar height 66 + its own 33 bottom offset, plus breathing room) or the
    // banner sits under it.
    paddingBottom: 116,
  },
  // Comp sets the header in very heavy sans, not the brand serif. Sized off
  // its 56px cap height (18.7dp) rather than the x-height: 25.5dp at Inter's
  // 0.733 cap ratio. Leading is near-solid (comp baselines are 25.7dp apart)
  // and tracking is tight — the comp's "Your logo" runs 6.20x its cap height
  // where untracked Inter Black runs 6.56x, hence the -0.8 letterSpacing.
  title: {
    color: '#FFFFFF',
    fontSize: 25.5,
    lineHeight: 26,
    fontFamily: FontFamily.accent.interBlack,
    letterSpacing: -0.8,
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: FontFamily.body.regular,
  },
  loading: {
    height: 200,
    marginTop: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Both card labels sample as pure white in the comp — the tagline is set
  // apart by being italic, not by being dimmed.
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    lineHeight: 16,
    fontFamily: FontFamily.accent.interBold,
    textAlign: 'center',
  },
  cardTagline: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    marginTop: 1,
    fontFamily: FontFamily.accent.sfProDisplayRegularItalic,
    textAlign: 'center',
  },
  bannerText: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    maxWidth: '52%',
  },
  bannerHeadline: {
    color: '#1C1616',
    fontSize: 29,
    lineHeight: 34,
    fontFamily: FontFamily.accent.sitkaDisplay,
  },
  bannerSubtitle: {
    color: '#57585A',
    fontSize: 12,
    lineHeight: 17.3,
    marginTop: 8,
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
});
