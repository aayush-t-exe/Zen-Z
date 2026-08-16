/**
 * Outlined surfaces. The 2.5px outline is this system's elevation, which
 * is why neither of these casts a shadow.
 */

import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Fonts, OUTLINE_WIDTH, Palette, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CardProps = {
  children: React.ReactNode;
  /** Overrides the neutral surface, e.g. an activity colour. */
  fill?: string;
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, fill, padding = 16, style }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: fill ?? theme.backgroundElement,
          borderColor: fill ? Palette.ink : theme.outline,
          borderWidth: OUTLINE_WIDTH,
          borderRadius: Radius.card,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type ChipProps = {
  label: string;
  /** Omit for an outline-only chip. */
  fill?: string;
  /** Defaults to ink, which is correct on every fill except cobalt. */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Chip({ label, fill, color, style }: ChipProps) {
  const theme = useTheme();
  const foreground = color ?? (fill ? Palette.ink : theme.text);
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          backgroundColor: fill ?? 'transparent',
          borderColor: fill ? Palette.ink : theme.outline,
          borderWidth: OUTLINE_WIDTH,
          borderRadius: Radius.pill,
          paddingVertical: 6,
          paddingHorizontal: 14,
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: Fonts.display, fontSize: 13, letterSpacing: -0.1, color: foreground }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * A fact the system knows exactly: a time, a countdown, a booking code, a
 * price. Never used for anything a person wrote.
 */
export function Mono({
  children,
  size = 12,
  color,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <Text
      style={[
        {
          fontFamily: Fonts.mono,
          fontSize: size,
          letterSpacing: -0.3,
          color: color ?? theme.text,
        },
        style as never,
      ]}
    >
      {children}
    </Text>
  );
}
