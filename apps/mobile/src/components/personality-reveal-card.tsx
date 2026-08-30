import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { PersonalityMascot, MASCOT_STOPS } from '@/components/personality-mascot';

const CARD_WIDTH = 216;
const CARD_HEIGHT = 288;

/**
 * The recap "energy card" — a deliberate, scoped exception to the app's
 * no-gradient/no-sparkle rule, matching Timeleft's tarot-card reveal moment.
 * Two faded, rotated cards sit behind the real one for a fanned-deck feel;
 * the real card pops in with a spring, then idles with a slow float.
 */
export function PersonalityRevealCard({ tier, label }: { tier: 0 | 1 | 2; label: string }) {
  const gradient = MASCOT_STOPS[tier];
  const progress = useSharedValue(tier / (MASCOT_STOPS.length - 1));

  const entrance = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    entrance.value = withSpring(1, { damping: 11, stiffness: 90, mass: 0.9 });
    float.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
  }, [entrance, float]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [
      { scale: 0.82 + entrance.value * 0.18 },
      { translateY: (1 - entrance.value) * 24 - float.value * 6 },
    ],
  }));

  return (
    <View style={styles.stack}>
      {/* Solid fills, not translucent ones — alpha-blending these hues against
          the black canvas desaturates them to mud instead of reading as color. */}
      <View style={[styles.card, styles.fanCard, { backgroundColor: gradient.footer, transform: [{ rotate: '-9deg' }] }]} />
      <View style={[styles.card, styles.fanCard, { backgroundColor: gradient.to, transform: [{ rotate: '7deg' }] }]} />

      <Animated.View style={[styles.card, styles.mainCard, { borderColor: gradient.footer }, cardStyle]}>
        <View style={styles.mascotArea}>
          <PersonalityMascot progress={progress} size={140} />
        </View>
        <View style={[styles.footer, { backgroundColor: gradient.footer }]}>
          <Text style={styles.footerLabel}>{label}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 26,
  },
  fanCard: {
    borderWidth: 0,
  },
  mainCard: {
    backgroundColor: Palette.paper,
    borderWidth: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 32,
  },
  mascotArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerLabel: {
    color: '#FFFDF6',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
    letterSpacing: 0.3,
  },
});
