import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';

import {
  FLOW_PILL_HEIGHT,
  FLOW_PILL_RATIO,
  FlowSurface,
  FlowText,
} from '@/constants/flow-theme';

/**
 * The redesign's primary action.
 *
 * Drawn in code rather than from booking-next-pill.png, which that art
 * permits: sampled across its whole interior it is a flat #FFFDF8 with no
 * gradient and no rim, and its corner reaches the edge at exactly half its
 * height — a plain stadium. `backgroundColor` plus `borderRadius: height / 2`
 * reproduces it exactly, and in exchange the button no longer needs to be
 * handed a pixel width just to size an <Image>, so it works on the pre-login
 * screens that lay out with padding instead of a fixed column. If the art is
 * ever redrawn with a gradient or a rim, this has to go back to the image.
 *
 * `width` is optional: pass it to sit exactly on the art's aspect within a
 * known column (the booking flow does), omit it to stretch to the parent at
 * FLOW_PILL_HEIGHT.
 *
 * The fill lives on a plain View with static styles, and press feedback is
 * plain state — not `style={({ pressed }) => ...}`. Android drops a
 * backgroundColor set through that callback form and leaves a hollow outline;
 * it looks correct on web either way, which is how it once shipped broken.
 * See components/auth-button.tsx for the full account.
 */
export function FlowPillButton({
  label,
  onPress,
  width,
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  width?: number;
  loading?: boolean;
  disabled?: boolean;
  style?: object;
}) {
  const [pressed, setPressed] = useState(false);
  const height = width !== undefined ? width * FLOW_PILL_RATIO : FLOW_PILL_HEIGHT;
  const isInert = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={isInert}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isInert }}
      accessibilityLabel={label}
      style={[
        width !== undefined ? { width } : styles.stretch,
        disabled && styles.inert,
        style,
      ]}>
      <View
        style={[
          styles.pill,
          { height, borderRadius: height / 2 },
          pressed && styles.pillPressed,
        ]}>
        {loading ? (
          <ActivityIndicator color={FlowSurface.ink} />
        ) : (
          <Text style={FlowText.pillLabel} numberOfLines={1}>
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stretch: {
    alignSelf: 'stretch',
  },
  inert: {
    opacity: 0.45,
  },
  pill: {
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pillPressed: {
    opacity: 0.82,
  },
});
