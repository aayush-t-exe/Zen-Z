import { Text, Pressable, Image, StyleSheet } from 'react-native';

import { FlowText } from '@/constants/flow-theme';

/** The centred "back" row the redesign's comps put under the primary action. */
export function FlowBackButton({ onPress, label = 'Back' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.row}>
      <Image
        source={require('@/assets/images/icon-arrow-left.png')}
        style={styles.arrow}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text style={FlowText.backLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  arrow: {
    width: 10,
    // icon-arrow-left.png is 120x84.
    height: 10 * (84 / 120),
  },
  headerArrow: {
    width: 16,
    height: 16 * (84 / 120),
  },
});

/**
 * The same arrow with no label, for a screen whose back control shares the top
 * of the screen with a progress bar rather than sitting under the CTA.
 */
export function FlowBackArrow({ onPress, label = 'Back' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Image
        source={require('@/assets/images/icon-arrow-left.png')}
        style={styles.headerArrow}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Pressable>
  );
}
