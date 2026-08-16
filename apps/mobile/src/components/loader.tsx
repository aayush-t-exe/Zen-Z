/**
 * Loading, without skeletons.
 *
 * A skeleton has to guess the shape of what is coming, and in this app
 * the shapes vary a lot (a group of four, a group of five, an empty
 * week). A wrong-shaped skeleton reads worse than an honest wait, so the
 * blobs hop instead.
 *
 * Honours the OS reduce-motion setting by holding still.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Fonts, OUTLINE_WIDTH, Palette, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const HOP_COLORS = [Palette.marigold, Palette.sindoor, Palette.cobalt];

function Hop({ color, delay, still, stroke }: { color: string; delay: number; still: boolean; stroke: string }) {
  const y = useSharedValue(0);

  useEffect(() => {
    if (still) {
      y.value = 0;
      return;
    }
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-13, { duration: 190, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 250, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 180 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, still, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Animated.View
      style={[
        {
          width: 16,
          height: 16,
          borderRadius: Radius.pill,
          backgroundColor: color,
          borderColor: stroke,
          borderWidth: OUTLINE_WIDTH,
        },
        style,
      ]}
    />
  );
}

export function Loader({ label }: { label?: string }) {
  const theme = useTheme();
  const [still, setStill] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (active) setStill(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setStill);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
      style={{ alignItems: 'center', gap: 14 }}
    >
      <View style={{ flexDirection: 'row', gap: 10, height: 30, alignItems: 'flex-end' }}>
        {HOP_COLORS.map((c, i) => (
          <Hop key={c} color={c} delay={i * 130} still={still} stroke={theme.outline} />
        ))}
      </View>
      {label && (
        <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: theme.textSecondary }}>{label}</Text>
      )}
    </View>
  );
}
