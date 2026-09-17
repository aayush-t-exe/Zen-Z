import type { ComponentProps } from 'react';
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import type { Tabs } from 'expo-router';
import { TabBarIcon } from '@/components/tab-bar-icon';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';

/**
 * Custom tab bar for the signed-in stack.
 *
 * The default bar can't produce the comp's floating pill: `tabBarStyle`'s
 * `left`/`right` are overridden by the navigator's own absolute offsets, and
 * `tabBarItemStyle` lands on an outer wrapper while the pressable inside it is
 * fixed at `justifyContent: 'flex-start'` with its own padding — so the active
 * pill could never be centred vertically from options alone. Owning the bar
 * makes the layout deterministic instead of fighting those internals.
 *
 * Geometry is measured off the approved comp (see index.tsx for how the comp
 * maps to dp), widened slightly on the founder's request so the active pill
 * doesn't crowd the bar's edge.
 */

const ICON_FOR: Record<string, 'compass' | 'calendar' | 'message-circle' | 'user'> = {
  index: 'compass',
  bookings: 'calendar',
  chats: 'message-circle',
  profile: 'user',
};

const LABEL_FOR: Record<string, string> = {
  index: 'Discover',
  bookings: 'Bookings',
  chats: 'Messages',
  profile: 'Profile',
};

// Taken from the navigator itself rather than hand-rolled, so this stays
// correct if expo-router's tab bar contract changes.
type HomeTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const SIDE_MARGIN = 46;
// Exported so (home)/_layout.tsx's exit toast can sit just clear of the bar
// without duplicating its geometry.
export const HOME_TAB_BAR_HEIGHT = 66;
const BAR_HEIGHT = HOME_TAB_BAR_HEIGHT;

/** Same floor-plus-inset rule the bar itself uses for its bottom margin. */
export const homeTabBarBottomMargin = (bottomInset: number) => Math.max(33, bottomInset + 12);

export function HomeTabBar({ state, descriptors, navigation, insets }: HomeTabBarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const barWidth = screenWidth - SIDE_MARGIN * 2;

  return (
    // The comp clears the bottom by 33dp. This bar owns its own safe-area
    // handling now that it isn't the navigator's, so hold that 33dp on
    // devices reporting no bottom inset (3-button nav) and lift further clear
    // of a gesture bar when there is one.
    <View style={[styles.bar, { marginBottom: homeTabBarBottomMargin(insets.bottom) }]}>
      {/* The designer's bar art, same as the cards use, rather than a flat
          fill — it carries the lit rim and the gradient that give the pill its
          sheen. Needs explicit width/height: an <Image> laid out with
          absoluteFill ignores it and renders at its intrinsic pixel size. */}
      <Image
        source={require('@/assets/images/home-navbar.png')}
        style={{ position: 'absolute', width: barWidth, height: BAR_HEIGHT }}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
      />
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const badge = descriptors[route.key]?.options?.tabBarBadge;
        const iconName = ICON_FOR[route.name];
        if (!iconName) return null;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={LABEL_FOR[route.name]}
            style={styles.item}>
            <TabBarIcon name={iconName} label={LABEL_FOR[route.name]} focused={focused} />
            {badge !== undefined && badge !== null ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText} numberOfLines={1}>
                  {badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // No background or border here — home-navbar.png supplies both, so the bar
  // picks up the same lit rim and sheen the activity cards have.
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    marginHorizontal: SIDE_MARGIN,
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 12,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: Palette.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    lineHeight: 12,
    fontFamily: FontFamily.body.semiBold,
  },
});
