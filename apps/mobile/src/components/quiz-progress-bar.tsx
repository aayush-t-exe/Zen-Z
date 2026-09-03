import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

/**
 * Thin top progress bar shared by the profile-creation and personality-quiz
 * step wizards. `step` is 0-indexed (the current step's completed count) so
 * the very first screen reads as genuinely empty, not a pre-filled sliver.
 *
 * `tintColor`, when passed, crossfades the fill to that color instead of the
 * plain default — used only by scale-type questions, whose progress bar
 * should read as gradient-colored to match the slider's current stop, per the
 * Timeleft reference.
 */

/** The fill takes the primary pill art's near-white, not the old cream. */
const FILL = '#FFFDF8';
/** Dim enough to read as an unfilled track against the redesign's black canvas. */
const TRACK = '#2A2A2A';

export function QuizProgressBar({ step, total, tintColor }: { step: number; total: number; tintColor?: string }) {
  const fraction = total > 0 ? Math.min(1, Math.max(0, step / total)) : 0;

  const color = useSharedValue(tintColor ?? FILL);

  useEffect(() => {
    color.value = tintColor ?? FILL;
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
    height: 3,
    borderRadius: 1.5,
    backgroundColor: TRACK,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    borderRadius: 1.5,
  },
});
