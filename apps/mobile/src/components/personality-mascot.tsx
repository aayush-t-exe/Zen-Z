import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
  interpolateColor,
  interpolate,
  Extrapolation,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  ReduceMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { AuthPalette as Palette } from '@/constants/auth-palette';

const SIZE = 108;
const CX = SIZE / 2;
const CY = SIZE / 2;
// Circle and Path are real drawable shapes with a native host view on
// Fabric, so Reanimated can find something to attach animated props to.
// <Stop> (a gradient-defs element with no view of its own) crashes with
// "Cannot find host instance for this component" the moment you wrap it in
// createAnimatedComponent — that's why this file has no <LinearGradient>,
// and why the face lives in its own plain <Svg> rather than a nested <G>
// (G is defs-like too, and animating its transform hits the same crash).
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * A deliberate, scoped exception to the app's no-gradient/no-pastel/no-sparkle
 * rule (see feedback_no_ai_slop_design_rules memory) — founder asked for exact
 * Timeleft parity on this mascot + the recap energy card, nowhere else.
 *
 * `progress` runs 0..1 across every stop, evenly spaced (stop i sits at
 * i / (count - 1)) — this is what makes the color a true continuous
 * interpolation instead of N discrete swaps.
 */
export const MASCOT_STOPS = [
  { from: '#F6E27A', to: '#F0B94E', footer: '#E3A83C' },
  { from: '#E7A9E0', to: '#C98FE8', footer: '#B678D6' },
  { from: '#F6935B', to: '#F17BA0', footer: '#E85E8C' },
] as const;

// Exported so anything else sharing this same color language (the slider's
// thumb, the top progress bar) reads from one source instead of
// re-declaring the hex values.
export const MASCOT_TO_COLORS = MASCOT_STOPS.map((s) => s.to);
export const MASCOT_STOP_POSITIONS = MASCOT_STOPS.map((_, i) => i / (MASCOT_STOPS.length - 1));

const MOUTH_PATH = `M ${CX - 15} ${CY + 18} Q ${CX} ${CY + 30} ${CX + 15} ${CY + 18}`;
const BASE_RADIUS = SIZE / 2 - 9;

function sparkPath(cx: number, cy: number, r: number) {
  const k = r * 0.18;
  return `M ${cx} ${cy - r} Q ${cx + k} ${cy - k} ${cx + r} ${cy} Q ${cx + k} ${cy + k} ${cx} ${cy + r} Q ${cx - k} ${cy + k} ${cx - r} ${cy} Q ${cx - k} ${cy - k} ${cx} ${cy - r} Z`;
}

/**
 * Reused in two places — same face always, different trim:
 * - the scale-question slider (live, as `progress` tracks the drag) wants
 *   `ring={false} sparkles={false}` — no outline, no sparkle accents, per
 *   the Timeleft reference frames.
 * - the recap energy card wants both on (its tarot-card reference does show
 *   a ring and sparkles), so they default to `true`.
 */
export function PersonalityMascot({
  progress,
  size = SIZE,
  ring = true,
  sparkles = true,
}: {
  progress: SharedValue<number>;
  size?: number;
  ring?: boolean;
  sparkles?: boolean;
}) {
  const breath = useSharedValue(0);

  useEffect(() => {
    // reduceMotion: Never — this is the mark's idle "alive" tell, not a
    // navigational or vestibular-risk animation, so it isn't suppressed by
    // the system reduced-motion setting the way it would be by default.
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false,
      undefined,
      ReduceMotion.Never
    );
  }, [breath]);

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.03 }],
  }));

  // Squash-and-stretch on the face only, driven straight off drag progress
  // (not its own timing/spring) — reacts every frame while dragging, not
  // just on release.
  const faceStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(progress.value, [0, 0.5, 1], [0.95, 1, 0.95], Extrapolation.CLAMP) },
      { scaleY: interpolate(progress.value, [0, 0.5, 1], [1.06, 1, 1.06], Extrapolation.CLAMP) },
    ],
  }));

  const baseProps = useAnimatedProps(() => ({
    fill: interpolateColor(progress.value, MASCOT_STOP_POSITIONS, MASCOT_TO_COLORS),
  }));

  const spark1Props = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [0, 0.28, 0.42], [0, 0, 0.9], Extrapolation.CLAMP),
  }));
  const spark2Props = useAnimatedProps(() => ({
    opacity: interpolate(progress.value, [0, 0.58, 0.72], [0, 0, 0.85], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View style={[StyleSheet.absoluteFill, breathStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {ring && <Circle cx={CX} cy={CY} r={SIZE / 2 - 4} fill="none" stroke={Palette.ring} strokeWidth={4} />}
          <AnimatedCircle cx={CX} cy={CY} r={BASE_RADIUS} animatedProps={baseProps} />
          {sparkles && (
            <>
              <AnimatedPath d={sparkPath(SIZE - 14, 16, 7)} fill="#FFFDF6" animatedProps={spark1Props} />
              <AnimatedPath d={sparkPath(12, 22, 5)} fill="#FFFDF6" animatedProps={spark2Props} />
            </>
          )}
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, faceStyle]} pointerEvents="none">
        <Svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Circle cx={CX - 14} cy={CY - 8} r={4} fill={Palette.line} />
          <Circle cx={CX + 14} cy={CY - 8} r={4} fill={Palette.line} />
          <Path d={MOUTH_PATH} stroke={Palette.line} strokeWidth={3.5} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
