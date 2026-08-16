/**
 * A hard offset shadow with zero blur.
 *
 * React Native cannot express this with shadow styles. iOS could
 * (shadowRadius: 0), but Android only has `elevation`, which is always
 * blurred and cannot be offset. Drawing it as an offset sibling View is
 * the only way to get the same mark on both platforms.
 *
 * Permitted on exactly two things in this app: the primary action on a
 * screen, and the active tab in the nav. Everywhere else, the 2.5px
 * outline is the elevation.
 *
 * The shadow is painted outside the layout box, so siblings can overlap
 * it. Pass `reserveSpace` when the element sits in a tight row.
 */

import { View, type ViewStyle } from 'react-native';

import { HARD_SHADOW_OFFSET, Palette } from '@/constants/theme';

export type HardShadowProps = {
  children: React.ReactNode;
  /** Must match the child's borderRadius or the mark will not line up. */
  radius: number;
  offset?: number;
  color?: string;
  /** Collapses the shadow, for the pressed state of a button. */
  hidden?: boolean;
  /** Adds margin so the shadow does not overlap siblings. */
  reserveSpace?: boolean;
  style?: ViewStyle;
};

export function HardShadow({
  children,
  radius,
  offset = HARD_SHADOW_OFFSET,
  color = Palette.ink,
  hidden = false,
  reserveSpace = false,
  style,
}: HardShadowProps) {
  return (
    <View
      style={[
        reserveSpace ? { marginRight: offset, marginBottom: offset } : null,
        style,
      ]}
    >
      {!hidden && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            backgroundColor: color,
            borderRadius: radius,
            transform: [{ translateX: offset }, { translateY: offset }],
          }}
        />
      )}
      {children}
    </View>
  );
}
