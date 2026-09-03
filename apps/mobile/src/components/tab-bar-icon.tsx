import { Image, ImageSourcePropType, View, Text, StyleSheet } from 'react-native';
import { FontFamily } from '@/constants/fonts';

// All four are exported tight-cropped to their glyph and padded to a square,
// so a single square box sizes them consistently. They were previously
// exported on the artboards they were drawn on, where the calendar/chat/user
// glyphs only filled ~31% of the canvas against the compass's 75% — at one
// box size that rendered the set at wildly different visual weights.
const ICONS: Record<string, ImageSourcePropType> = {
  compass: require('@/assets/images/nav-discover-v2.png'),
  calendar: require('@/assets/images/nav-booking-v2.png'),
  'message-circle': require('@/assets/images/nav-chats-v2.png'),
  user: require('@/assets/images/nav-profile-v2.png'),
};

interface TabBarIconProps {
  name: keyof typeof ICONS;
  label: string;
  focused: boolean;
}

/**
 * Renders the icon *and* its label together, because in the approved comp the
 * active state is a rounded highlight drawn around both — not around the icon
 * alone. The tab navigator therefore runs with `tabBarShowLabel: false` and
 * this owns the label.
 */
export function TabBarIcon({ name, label, focused }: TabBarIconProps) {
  return (
    <View style={[styles.pill, focused && styles.pillFocused]}>
      <Image
        source={ICONS[name]}
        resizeMode="contain"
        style={styles.icon}
        accessibilityIgnoresInvertColors
      />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// Sizes measured off the comp's nav bar (290x53.7dp): icon ~14.5dp, label cap
// height 5.3dp — which SF Pro Display Light hits exactly at 7.5dp — and the
// active pill 46x41dp carrying its own lit border, same as the bar's.
const styles = StyleSheet.create({
  pill: {
    width: 48,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillFocused: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  // These assets carry ~10% transparent padding from being squared off, so
  // the drawn glyph lands ~2dp smaller than the box it sits in.
  icon: {
    width: 19,
    height: 19,
  },
  label: {
    marginTop: 2.5,
    fontSize: 8.5,
    lineHeight: 10,
    letterSpacing: -0.25,
    color: '#FFFFFF',
    fontFamily: FontFamily.accent.sfProDisplayLight,
  },
});
