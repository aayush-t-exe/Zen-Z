import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { activityArt } from '@/constants/activity-art';
import { ActivityCard, ACTIVITY_GRID, activityCardMetrics } from '@/components/activity-card';
import { FlowPillButton } from '@/components/flow-pill-button';
import { FlowBackButton } from '@/components/flow-back-button';
import { supabase } from '@/lib/supabase';
import { formatDuration } from '@/lib/format';

interface SportOption {
  id: number;
  name: string;
  convenience_fee: number;
  duration_minutes: number | null;
}

/**
 * The games behind the Home grid's Sports card, drawn on the same card as
 * that grid (components/activity-card.tsx) rather than the cream frame this
 * screen used before the redesign — it is the same "pick one of these"
 * question one level down, and the founder's new game renders are made for
 * that dark badge.
 *
 * Each card's second line carries the game's price and length, which
 * docs/PRODUCT_SPEC.md §1.5a assumes is "shown up front" (it is why the
 * Budget step is skipped for these) but which this screen never actually
 * showed.
 */
const taglineFor = (option: SportOption) =>
  option.duration_minutes != null
    ? `₹${option.convenience_fee} · ${formatDuration(option.duration_minutes)}`
    : `₹${option.convenience_fee}`;

export default function SportsSelectScreen() {
  const router = useRouter();
  const { parentId } = useLocalSearchParams<{ parentId: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [options, setOptions] = useState<SportOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const contentWidth = Math.min(480, screenWidth - ACTIVITY_GRID.sidePadding * 2);
  const { width: cardWidth } = activityCardMetrics(contentWidth);

  const loadOptions = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('activity_types')
      .select('id, name, convenience_fee, duration_minutes')
      .eq('parent_activity_id', parseInt(parentId || '0'))
      .eq('is_live', true)
      .order('id', { ascending: true });

    if (error) {
      setLoadError(error.message);
      setIsLoading(false);
      return;
    }

    if (data) setOptions(data);
    setIsLoading(false);
  }, [parentId]);

  useFocusEffect(
    useCallback(() => {
      loadOptions();
    }, [loadOptions])
  );

  const handleSelect = (optionId: number) => {
    router.push({
      pathname: '/booking-flow' as any,
      params: { activityId: optionId.toString() },
    });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.content, { width: contentWidth, paddingBottom: 24 + insets.bottom }]}>
        <View style={{ gap: 6 }}>
          <Text style={styles.title}>Pick a{'\n'}game</Text>
          <Text style={styles.subtitle}>Four games this week.</Text>
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Palette.text} />
          </View>
        ) : options.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              columnGap: ACTIVITY_GRID.columnGap,
              rowGap: ACTIVITY_GRID.rowGap,
              marginTop: 40,
            }}>
            {options.map((option) => (
              <ActivityCard
                key={option.id}
                name={option.name}
                tagline={taglineFor(option)}
                art={activityArt(option.name)}
                width={cardWidth}
                onPress={() => handleSelect(option.id)}
              />
            ))}
          </View>
        ) : loadError ? (
          <View style={styles.loading}>
            <Text style={[styles.subtitle, { textAlign: 'center' }]}>
              Couldn&apos;t load games. {loadError}
            </Text>
            <View style={{ marginTop: 16, width: contentWidth }}>
              <FlowPillButton label="Retry" width={contentWidth} onPress={loadOptions} loading={isLoading} />
            </View>
          </View>
        ) : (
          <Text style={[styles.subtitle, { marginTop: 40 }]}>No games available at the moment.</Text>
        )}

        {/* This screen is pushed on top of the tabs and has no primary action
            of its own, so the flow's back row is the only visible way out —
            on iOS the swipe gesture was previously it. */}
        <View style={{ marginTop: 44 }}>
          <FlowBackButton onPress={() => router.back()} />
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
    // No tab-bar reservation, unlike Home: this screen is pushed on top of the
    // tabs as its own stack (see (flow)/_layout.tsx), so nothing floats over it.
    paddingTop: 24,
  },
  // Home's own header type — Inter Black, near-solid leading, tight tracking —
  // since this screen is the same grid one level down.
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
});
