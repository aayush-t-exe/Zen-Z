import { useState, useRef, useEffect } from 'react';
import {
  View,
  Pressable,
  FlatList,
  Text,
  StyleSheet,
  Image,
  useWindowDimensions,
  type ImageSourcePropType,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FlowText, flowTracking } from '@/constants/flow-theme';
import { FlowPillButton } from '@/components/flow-pill-button';

/**
 * onboarding-mark.png is 376x420. The new brand mark stands upright where the
 * one it replaced lay on its side, so this is portrait now — which is why the
 * width below shrank: it keeps the mark's drawn height roughly where it was,
 * rather than letting a 110dp-wide portrait mark grow 46dp taller and eat into
 * the slide art box.
 */
const MARK_RATIO = 420 / 376;

/** How long each slide holds before the carousel moves itself along. */
const AUTO_ADVANCE_MS = 4500;

type Slide = {
  id: string;
  /** Absent until the artwork for that slide has been drawn. */
  art?: ImageSourcePropType;
  /** Intrinsic height divided by width, so the drawing is never distorted. */
  artRatio?: number;
  artLabel?: string;
  title?: string;
  subtitle?: string;
  tagline?: string;
};

const SLIDES: Slide[] = [
  {
    id: '0',
    art: require('@/assets/images/onboarding-gathering.png'),
    artRatio: 1217 / 1056,
    artLabel: 'Four friends high-fiving around a table with a coffee and a film reel',
    tagline: 'Somewhere nearby, four strangers\nare about to become your next story.',
  },
  {
    id: '1',
    art: require('@/assets/images/onboarding-tables.png'),
    artRatio: 1216 / 1056,
    artLabel: 'Pairs and groups talking over coffee, dinner and a film, wrapped in swirls',
    title: 'You answer a few questions.',
    subtitle: 'We actually read them.',
  },
  {
    id: '2',
    art: require('@/assets/images/onboarding-hands.png'),
    artRatio: 1410 / 1200,
    artLabel: 'Hands drawing four strangers together into one group',
    title: 'We build the group by hand.',
    subtitle: 'You just show up.',
  },
  {
    id: '3',
    art: require('@/assets/images/onboarding-invitation.png'),
    artRatio: 1335 / 1072,
    artLabel: 'An open envelope with a laid table and a film reel spilling out of it',
    title: 'No swiping. No profiles.',
    subtitle: 'Nobody sees your photo.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const markWidth = Math.min(75, screenWidth * 0.2);
  // Every slide gets the same art box: full-bleed but for a small margin, and
  // tall enough for the tallest drawing. Each image then fits inside it, so the
  // copy underneath sits at the same height on every page instead of hopping
  // about as you swipe. The box is clamped so it cannot crowd out the footer.
  const tallestRatio = Math.max(...SLIDES.map((s) => s.artRatio ?? 0));
  const artWidth = Math.min(screenWidth - 22, (screenHeight - 400) / tallestRatio);
  const artHeight = artWidth * tallestRatio;

  const isLast = currentIndex === SLIDES.length - 1;

  // Every page is exactly one screen wide, so scrolling by offset is both the
  // simplest and the most reliable option. `scrollToIndex` depends on the row
  // having been measured and quietly does nothing when it has not been.
  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    flatListRef.current?.scrollToOffset({ offset: screenWidth * index, animated: true });
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      goToSlide(currentIndex + 1);
    } else {
      router.push('/(auth)/email-input');
    }
  };

  const handleContinue = () => {
    router.push('/(auth)/email-input');
  };

  // Only trust the index once a scroll has settled. Reading it continuously
  // during the glide would report the page being left behind and flip the
  // footer back for a frame or two.
  const handleScrollSettled = (event: any) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  };

  // Walk the slides along on their own. The timer restarts whenever the slide
  // changes, so a swipe or a tap on Next resets the dwell rather than fighting
  // it, and it stops on the last slide so the call to action stays put.
  useEffect(() => {
    if (currentIndex >= SLIDES.length - 1) return;

    const timer = setTimeout(() => {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToOffset({
        offset: screenWidth * nextIndex,
        animated: true,
      });
    }, AUTO_ADVANCE_MS);

    return () => clearTimeout(timer);
  }, [currentIndex, screenWidth]);

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.page, { width: screenWidth }]}>
      <Image
        source={require('@/assets/images/onboarding-mark.png')}
        style={{ width: markWidth, height: markWidth * MARK_RATIO }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      {item.art ? (
        <Image
          source={item.art}
          style={{ width: artWidth, height: artHeight, marginTop: -4 }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityRole="image"
          accessibilityLabel={item.artLabel}
        />
      ) : (
        <View style={{ width: artWidth, height: artHeight, marginTop: -4 }} />
      )}
      {/* The break in `tagline` is deliberate: it is the split in the design. */}
      {item.tagline && <Text style={styles.tagline}>{item.tagline}</Text>}
      {item.title && <Text style={styles.title}>{item.title}</Text>}
      {item.subtitle && <Text style={styles.subtitle}>{item.subtitle}</Text>}
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        getItemLayout={(_, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        scrollEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollSettled}
        onScrollEndDrag={handleScrollSettled}
      />

      {currentIndex === 0 ? (
        <View style={[styles.footerSplash, { paddingBottom: 28 + insets.bottom }]}>
          <FlowPillButton label="Begin  →" onPress={handleNext} />
          <Pressable onPress={handleContinue} hitSlop={12}>
            {({ pressed }) => (
              <Text style={[FlowText.link, pressed && styles.pressedText]}>
                Already in? Continue
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={[styles.footerIntro, { paddingBottom: 62 + insets.bottom }]}>
          <PageDots count={SLIDES.length - 1} active={currentIndex - 1} />
          <FlowPillButton label={isLast ? 'Begin  →' : 'Next  →'} onPress={handleNext} />
        </View>
      )}
    </View>
  );
}

/** The page you are on is a cream spark; the rest are muted dots. */
function PageDots({ count, active }: { count: number; active: number }) {
  return (
    <View
      style={styles.dots}
      accessibilityRole="tablist"
      accessibilityLabel={`Page ${active + 1} of ${count}`}>
      {Array.from({ length: count }, (_, idx) =>
        idx === active ? (
          <Image
            key={idx}
            source={require('@/assets/images/onboarding-spark.png')}
            style={styles.spark}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View key={idx} style={styles.dot} />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 56,
  },
  // The splash slide's poetic line is the one heading here that isn't a
  // hard statement, so it takes the lighter centred weight the option steps
  // use rather than the display cut.
  tagline: {
    ...FlowText.titleCentred,
    fontSize: 19.5,
    lineHeight: 29,
    letterSpacing: flowTracking(19.5),
    paddingHorizontal: 18,
    marginTop: 24,
  },
  title: {
    ...FlowText.display,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: flowTracking(28),
    paddingHorizontal: 14,
    marginTop: 20,
  },
  subtitle: {
    ...FlowText.subtitle,
    fontSize: 19,
    lineHeight: 27,
    textAlign: 'center',
    paddingHorizontal: 14,
    marginTop: 2,
  },
  footerSplash: {
    paddingHorizontal: 21,
    gap: 20,
  },
  footerIntro: {
    paddingHorizontal: 21,
    gap: 22,
  },
  pressedText: {
    opacity: 0.6,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  dot: {
    width: 8,
    height: 8,
    // Half the width, not a catch-all number: a radius far larger than the view
    // makes Android drop the background entirely.
    borderRadius: 4,
    backgroundColor: Palette.dotIdle,
  },
  spark: {
    width: 18,
    height: 18,
  },
});
