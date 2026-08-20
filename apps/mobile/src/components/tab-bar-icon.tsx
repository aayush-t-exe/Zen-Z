import { Image, ImageSourcePropType } from 'react-native';

// Native pixel sizes of the extracted nav art vary per icon (they weren't
// drawn on a shared square grid) — sizing every icon to the same fixed
// width/height box squashes the non-square ones, making the set look
// inconsistent. Fixing height and deriving width from each icon's own
// aspect ratio keeps their visual weight even instead.
const ICONS: Record<string, { source: ImageSourcePropType; ratio: number }> = {
  compass: { source: require('@/assets/images/nav-discover.png'), ratio: 216 / 314 },
  calendar: { source: require('@/assets/images/nav-booking.png'), ratio: 302 / 309 },
  'message-circle': { source: require('@/assets/images/nav-chats.png'), ratio: 303 / 292 },
  user: { source: require('@/assets/images/nav-profile.png'), ratio: 267 / 294 },
};

interface TabBarIconProps {
  name: keyof typeof ICONS;
  focused: boolean;
  size?: number;
}

export function TabBarIcon({ name, focused, size = 26 }: TabBarIconProps) {
  const { source, ratio } = ICONS[name];
  return (
    <Image
      source={source}
      resizeMode="contain"
      style={{ width: size * ratio, height: size, opacity: focused ? 1 : 0.45 }}
    />
  );
}
