/**
 * The one place in the app allowed to cast a shadow, alongside the active
 * nav tab. Pressing moves the button into its own shadow rather than
 * fading or scaling it, which is the whole gesture of the system: solid
 * objects with outlines, moved around.
 */

import { useState } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { HardShadow } from '@/components/hard-shadow';
import { Icon, type IconName } from '@/components/icon';
import {
  Fonts,
  HARD_SHADOW_OFFSET,
  OUTLINE_WIDTH,
  Palette,
  Radius,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant = 'primary' | 'danger' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  disabled?: boolean;
  /** Fills the available width. Default for a screen's main action. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SIZES = {
  md: { paddingVertical: 13, paddingHorizontal: 26, fontSize: 15, icon: 18 },
  lg: { paddingVertical: 17, paddingHorizontal: 32, fontSize: 17, icon: 20 },
} as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  block = false,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  const s = SIZES[size];

  const casts = variant === 'primary' || variant === 'danger';

  const fill =
    variant === 'primary' ? Palette.marigold
    : variant === 'danger' ? Palette.sindoor
    : 'transparent';

  const content = variant === 'ghost' ? theme.textSecondary : Palette.ink;
  const foreground = casts ? Palette.ink : content;
  const border =
    variant === 'secondary' ? theme.outline
    : variant === 'ghost' ? 'transparent'
    : Palette.ink;

  const sunk = casts && pressed;

  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        backgroundColor: fill,
        borderColor: border,
        borderWidth: variant === 'ghost' ? 0 : OUTLINE_WIDTH,
        borderRadius: Radius.pill,
        paddingVertical: s.paddingVertical,
        paddingHorizontal: s.paddingHorizontal,
        opacity: disabled ? 0.45 : 1,
        transform: sunk
          ? [{ translateX: HARD_SHADOW_OFFSET }, { translateY: HARD_SHADOW_OFFSET }]
          : undefined,
      }}
    >
      {icon && <Icon name={icon} size={s.icon} color={variant === 'ghost' ? content : foreground} />}
      <Text
        style={{
          fontFamily: Fonts.display,
          fontSize: s.fontSize,
          letterSpacing: -0.2,
          color: variant === 'ghost' ? content : foreground,
        }}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[block ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}
    >
      {casts && !disabled ? (
        <HardShadow radius={Radius.pill} hidden={sunk}>
          {body}
        </HardShadow>
      ) : (
        body
      )}
    </Pressable>
  );
}
