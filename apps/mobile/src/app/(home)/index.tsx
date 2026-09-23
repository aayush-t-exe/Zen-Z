import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { activityArt } from '@/constants/activity-art';
import { ActivityCard, ACTIVITY_GRID, activityCardMetrics } from '@/components/activity-card';
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
 *
 * The activity card itself now lives in components/activity-card.tsx, which
 * the Sports games grid draws from too; only this screen's banner is measured
 * here.
 */
const CARD_TO_BANNER_GAP = 42; // comp 126px
const BANNER_RATIO = 488 / 1046; // banner height / banner width
// Illustration placement, taken from its keyed-out bounds inside the comp's
// banner box: flush with the banner's bottom edge, a hair in from the right.
const PEOPLE_W_RATIO = 0.4761; // of banner width
const PEOPLE_H_RATIO = 0.8299; // of banner height
const PEOPLE_RIGHT_RATIO = 0.0229; // of banner width
const BANNER_TEXT_LEFT_RATIO = 84 / 1046; // text inset / banner width
const BANNER_TEXT_TOP_RATIO = 0.164; // text block top / banner height

const taglineFor = (name: string) =>
  name === 'Movies'
    ? 'Unlock Your Seat'
    : name === 'Sports'
      ? 'Unlock Your Game'
      : 'Unlock Your Table';

export default function HomeScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [firstName, setFirstName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const contentWidth = Math.min(480, screenWidth - ACTIVITY_GRID.sidePadding * 2);
  const { width: cardWidth } = activityCardMetrics(contentWidth);
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.content,
            {
              width: contentWidth,
              // Native's navigator keeps screens clear of the status bar on
              // its own; the web build has to reserve it, and this is the
              // one screen that starts flush with the top rather than
              // carrying a comp-tuned top padding of its own.
              paddingTop: 24 + (Platform.OS === 'web' ? insets.top : 0),
            },
          ]}>
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
              columnGap: ACTIVITY_GRID.columnGap,
              rowGap: ACTIVITY_GRID.rowGap,
              marginTop: 40,
            }}>
            {activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                name={activity.name}
                tagline={taglineFor(activity.name)}
                art={activityArt(activity.name)}
                width={cardWidth}
                onPress={() => handleActivityPress(activity)}
              />
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  // Centring lives here rather than on the content below, so it still
  // centres when there's room but scrolls once there isn't. As `flex: 1` +
  // `justifyContent: 'center'` on a plain View, a screen too short for the
  // grid and the banner spilled the overflow equally off both ends — and
  // the half above the top edge was unreachable, so the greeting was
  // simply cut in half. Reported live on iOS web, where the usable height
  // runs shorter than the handset this was laid out against.
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
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
