import { useState } from 'react';
import { View, Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';

import { AuthPalette as Palette } from '@/constants/auth-palette';

/**
 * The primary button used across every pre-login screen: a slate ring, a dark
 * gap, then the cream pill. Measured off the design at 4pt ring / 2pt gap.
 *
 * Deliberately plain in how it is built. Android was dropping the cream fill and
 * leaving a hollow outline, and device testing narrowed it to this: a plain View
 * with fill + radius + border renders correctly, but the same fill on a
 * Pressable styled with the `({ pressed }) => ...` callback form does not. That
 * callback path goes through NativeWind's component wrapping.
 *
 * So: the fill lives on a plain View, and every style here is a static object.
 * Press feedback is plain state rather than the callback. Do not "tidy" this
 * back into `style={({ pressed }) => ...}` without an Android device to hand —
 * it looks correct on web either way, which is how it shipped broken.
 */
const PILL_HEIGHT = 54;
const RING_BORDER = 4;
const RING_GAP = 2;

export function AuthButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: object;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={loading || disabled}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled }}
      accessibilityLabel={label}
      style={[styles.ring, disabled && styles.ringDisabled, style]}>
      <View style={[styles.pill, pressed && styles.pillPressed]}>
        {loading ? (
          <ActivityIndicator color={Palette.line} />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: RING_BORDER,
    borderColor: Palette.ring,
    // Outer radius = the pill's radius plus everything wrapped around it.
    borderRadius: PILL_HEIGHT / 2 + RING_GAP + RING_BORDER,
    padding: RING_GAP,
    backgroundColor: Palette.canvas,
  },
  ringDisabled: {
    opacity: 0.4,
  },
  pill: {
    backgroundColor: Palette.paper,
    borderRadius: PILL_HEIGHT / 2,
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pillPressed: {
    opacity: 0.82,
  },
  label: {
    color: Palette.line,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
});
