import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

/**
 * Weight comes from the loaded font file, never from `fontWeight`. Pairing
 * an explicit fontFamily with a numeric weight makes Android synthesise a
 * fake bold on top of a face that is already bold.
 */
const styles = StyleSheet.create({
  default: {
    fontFamily: Fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
  small: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: Fonts.bodySemi,
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 40,
    lineHeight: 40,
    letterSpacing: -1.5,
  },
  subtitle: {
    fontFamily: Fonts.display,
    fontSize: 26,
    lineHeight: 29,
    letterSpacing: -0.8,
  },
  link: {
    fontFamily: Fonts.bodySemi,
    fontSize: 14,
    lineHeight: 22,
    textDecorationLine: 'underline',
  },
  // Cobalt is welded to Movie, so a link does not borrow it. Underlined
  // ink carries the affordance without spending an accent.
  linkPrimary: {
    fontFamily: Fonts.bodySemi,
    fontSize: 14,
    lineHeight: 22,
    textDecorationLine: 'underline',
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: -0.3,
  },
});
