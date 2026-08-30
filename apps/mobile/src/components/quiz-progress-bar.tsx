import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { AuthPalette as Palette } from '@/constants/auth-palette';

/**
 * Thin top progress bar shared by the profile-creation and personality-quiz
 * step wizards. `step` is 0-indexed (the current step's completed count) so
 * the very first screen reads as genuinely empty, not a pre-filled sliver.
 *
 * `tintColor`, when passed, crossfades the fill to that color instead of
 * the plain cream default — used only by scale-type questions, whose
 * progress bar should read as gradient-colored to match the slider's
 * current stop, per the Timeleft reference.
 */
export function QuizProgressBar({ step, total, tintColor }: { step: number; total: number; tintColor?: string }) {
  const fraction = total > 0 ? Math.min(1, Math.max(0, step / total)) : 0;

  const color = useSharedValue(tintColor ?? Palette.paper);

  useEffect(() => {
    color.value = tintColor ?? Palette.paper;
  }, [tintColor, color]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fraction * 100}%`,
    backgroundColor: withTiming(color.value, { duration: 250 }),
  }));

  return (
    <Animated.View style={styles.track}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.ring,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
});
