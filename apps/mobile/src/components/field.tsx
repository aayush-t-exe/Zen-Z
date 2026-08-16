/**
 * Text input. Flat-cut corners, outline elevation, no shadow.
 *
 * Focus turns the outline marigold rather than adding a ring: marigold
 * already means "the active thing" everywhere else in the app, so the
 * state reads without introducing a colour that means nothing else.
 */

import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { Fonts, OUTLINE_WIDTH, Palette, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type FieldProps = TextInputProps & {
  label?: string;
  /** Explains what went wrong and how to fix it. Turns the outline sindoor. */
  error?: string;
  /** Times, codes and amounts render in the mono face. */
  mono?: boolean;
};

export function Field({ label, error, mono = false, style, onFocus, onBlur, ...rest }: FieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const border = error ? Palette.sindoor : focused ? Palette.marigold : theme.outline;

  return (
    <View style={{ gap: 7 }}>
      {label && (
        <Text
          style={{
            fontFamily: Fonts.bodySemi,
            fontSize: 12,
            letterSpacing: 1.3,
            textTransform: 'uppercase',
            color: theme.textSecondary,
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor={theme.textSecondary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            borderColor: border,
            borderWidth: OUTLINE_WIDTH,
            borderRadius: Radius.card,
            paddingVertical: 13,
            paddingHorizontal: 15,
            fontFamily: mono ? Fonts.mono : Fonts.body,
            fontSize: mono ? 15 : 16,
            color: theme.text,
            backgroundColor: 'transparent',
          },
          style,
        ]}
        {...rest}
      />
      {error && (
        <Text style={{ fontFamily: Fonts.body, fontSize: 13, color: Palette.sindoor }}>{error}</Text>
      )}
    </View>
  );
}
