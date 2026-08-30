import { useEffect, useRef } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { markJaipurIntroSeen } from '@/lib/launch-intro';

const AUTO_ADVANCE_MS = 4400;

// Same duration+dampingRatio spring signature as the quiz slider's snap
// (see scale-question-slider.tsx) — reused here so the big reveal shares
// the app's one spring feel instead of inventing a second.
const REVEAL_SPRING = { duration: 500, dampingRatio: 0.72, reduceMotion: ReduceMotion.Never };

/**
 * A one-time, full-screen "we're only in Jaipur, for now" reveal shown
 * before onboarding on a student's very first launch — never again after
 * that (see lib/launch-intro.ts), and never surfaced anywhere else in the
 * app. Not a slide in the onboarding carousel: this is a single deliberate
 * beat that happens once, ever.
 */
export default function JaipurIntroScreen() {
  const router = useRouter();
  const hasAdvanced = useRef(false);

  const eyebrowOpacity = useSharedValue(0);
  const eyebrowY = useSharedValue(10);
  const bigOpacity = useSharedValue(0);
  const bigScale = useSharedValue(0.55);
  const footerOpacity = useSharedValue(0);

  useEffect(() => {
    eyebrowOpacity.value = withDelay(150, withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }));
    eyebrowY.value = withDelay(150, withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) }));

    // The reveal itself: starts small and grows to full size as it fades
    // in, landing with the same small overshoot as the slider's snap so it
    // feels caught rather than just stopped.
    bigOpacity.value = withDelay(550, withTiming(1, { duration: 380 }));
    bigScale.value = withDelay(550, withSpring(1, REVEAL_SPRING));

    footerOpacity.value = withDelay(1650, withTiming(1, { duration: 420 }));
  }, [eyebrowOpacity, eyebrowY, bigOpacity, bigScale, footerOpacity]);

  const handleContinue = async () => {
    if (hasAdvanced.current) return;
    hasAdvanced.current = true;
    await markJaipurIntroSeen();
    router.replace('/(auth)/onboarding');
  };

  useEffect(() => {
    const timer = setTimeout(handleContinue, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleContinue is stable enough for a one-shot mount timer
  }, []);

  const eyebrowStyle = useAnimatedStyle(() => ({
    opacity: eyebrowOpacity.value,
    transform: [{ translateY: eyebrowY.value }],
  }));

  const bigStyle = useAnimatedStyle(() => ({
    opacity: bigOpacity.value,
    transform: [{ scale: bigScale.value }],
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
  }));

  return (
    <Pressable
      style={styles.root}
      onPress={handleContinue}
      accessibilityRole="button"
      accessibilityLabel="Continue to onboarding">
      <View style={styles.center}>
        <Animated.Text style={[styles.eyebrow, eyebrowStyle]}>Right now,</Animated.Text>
        <Animated.Text style={[styles.big, bigStyle]}>{'we’re only\nin Jaipur.'}</Animated.Text>
      </View>
      <Animated.Text style={[styles.footer, footerStyle]}>More cities are unfolding soon.</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
    paddingHorizontal: 32,
    paddingTop: 56,
    paddingBottom: 48,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  eyebrow: {
    color: Palette.muted,
    fontSize: 16,
    fontFamily: FontFamily.body.medium,
    letterSpacing: 0.2,
  },
  big: {
    color: Palette.text,
    fontSize: 42,
    lineHeight: 50,
    fontFamily: FontFamily.display.bold,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  footer: {
    color: Palette.muted,
    fontSize: 13,
    fontFamily: FontFamily.body.regular,
    textAlign: 'center',
  },
});
