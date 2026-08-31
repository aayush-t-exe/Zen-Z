import { useState } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';

/**
 * Full-width rounded selector used for both single-select (radio) and
 * multi-select (check) quiz/profile steps.
 *
 * Fill lives on a plain View, not a callback-styled Pressable — see
 * AuthButton's comment. The same Android bug (backgroundColor silently not
 * painting on a Pressable using `style={({pressed}) => ...}`) applies here.
 */
export function OptionPill({
  label,
  selected,
  onPress,
  variant = 'radio',
  dimmed = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  variant?: 'radio' | 'check';
  /** True when a sibling in the same list is selected and this one isn't — fades this pill so the pick stands out. */
  dimmed?: boolean;
}) {
  const [pressed, setPressed] = useState(false);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(dimmed ? 0.35 : 1, { duration: 220 }),
  }));

  return (
    <Animated.View style={fadeStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole={variant === 'radio' ? 'radio' : 'checkbox'}
        accessibilityState={{ checked: selected }}
        accessibilityLabel={label}>
        <View style={[styles.pill, selected && styles.pillSelected, pressed && styles.pillPressed]}>
          <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          <View
            style={[
              styles.marker,
              variant === 'check' && styles.markerCheck,
              selected && styles.markerSelected,
            ]}>
            {selected && variant === 'check' && <Text style={styles.checkGlyph}>{'✓'}</Text>}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2.5,
    borderColor: Palette.ring,
    borderRadius: 28,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  pillSelected: {
    backgroundColor: Palette.paper,
    borderColor: Palette.paper,
  },
  pillPressed: {
    opacity: 0.82,
  },
  label: {
    color: Palette.text,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
    flexShrink: 1,
    paddingRight: 12,
  },
  labelSelected: {
    color: Palette.line,
  },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Palette.muted,
  },
  markerCheck: {
    borderRadius: 6,
  },
  markerSelected: {
    borderColor: Palette.line,
    backgroundColor: Palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: {
    color: Palette.paper,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamily.body.bold,
  },
});
