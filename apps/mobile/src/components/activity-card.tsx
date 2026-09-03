import { useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, type ImageSourcePropType } from 'react-native';

import { FontFamily } from '@/constants/fonts';

/**
 * The card the Home grid is built from, and the one the Sports games grid
 * reuses — both screens ask the same question ("pick one of these") and the
 * approved Home comp (Desktop/UI/UI PAGE 1) is the answer to it, so the
 * geometry lives here rather than being measured twice.
 *
 * That comp is 1170x2532 — a 390pt screen at @3x — so comp pixels divide by 3
 * for dp. Ratios rather than fixed dp throughout, so a card tracks its column
 * as the screen width changes.
 */

/** Card art aspect: home-card-frame.png is 1024x974 drawn as a 504x476 box. */
const CARD_RATIO = 476 / 504;
/** Badge diameter / card width. */
const BADGE_RATIO = 245 / 504;
/** Render / badge diameter. */
const ICON_RATIO = 0.7;
/** Badge inset from the card's top / card width. */
const BADGE_TOP_RATIO = 8.3 / 168;
/** Badge-to-title gap / card width. */
const TITLE_GAP_RATIO = 19.1 / 168;

/** Grid spacing from the same comp — the row gap is notably wider than the column gap. */
export const ACTIVITY_GRID = {
  /** Screen side margin (comp 64px). Narrower than the flow screens' 34dp. */
  sidePadding: 21,
  columnGap: 13,
  rowGap: 33,
} as const;

/** Two columns in `contentWidth`, and the height the art wants for one. */
export function activityCardMetrics(contentWidth: number) {
  const width = (contentWidth - ACTIVITY_GRID.columnGap) / 2;
  return { width, height: width * CARD_RATIO };
}

export function ActivityCard({
  name,
  tagline,
  art,
  width,
  onPress,
}: {
  name: string;
  /** The card's second line — Home's "Unlock Your Table", a game's price and length. */
  tagline: string;
  art: ImageSourcePropType;
  width: number;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const height = width * CARD_RATIO;
  const badgeSize = width * BADGE_RATIO;
  const iconSize = badgeSize * ICON_RATIO;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${tagline}`}
      style={{ width, height, opacity: pressed ? 0.82 : 1 }}>
      <Image
        source={require('@/assets/images/home-card-frame.png')}
        style={{ width, height }}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
      />
      <View
        style={[StyleSheet.absoluteFill, { alignItems: 'center', paddingTop: width * BADGE_TOP_RATIO }]}>
        <View
          style={{
            width: badgeSize,
            height: badgeSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {/* Both of these need explicit width/height: an <Image> given
              StyleSheet.absoluteFill ignores it and lays out at its intrinsic
              pixel size instead, which rendered this badge at 700dp — several
              times the screen width. */}
          <Image
            source={require('@/assets/images/home-icon-badge.png')}
            style={{ position: 'absolute', width: badgeSize, height: badgeSize }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <Image
            source={art}
            style={{ width: iconSize, height: iconSize }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </View>
        <Text style={[styles.title, { marginTop: width * TITLE_GAP_RATIO }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.tagline} numberOfLines={1}>
          {tagline}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Both labels sample as pure white in the comp — the tagline is set apart by
  // being italic, not by being dimmed.
  title: {
    color: '#FFFFFF',
    fontSize: 13.5,
    lineHeight: 16,
    fontFamily: FontFamily.accent.interBold,
    textAlign: 'center',
  },
  tagline: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    marginTop: 1,
    fontFamily: FontFamily.accent.sfProDisplayRegularItalic,
    textAlign: 'center',
  },
});
