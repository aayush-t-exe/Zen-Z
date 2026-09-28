import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  View,
  Text,
  Pressable,
  Image,
  Platform,
  StyleSheet,
  type ImageSourcePropType,
} from 'react-native';

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

/** Sampled off the red 3D Z brand mark. */
const BRAND_RED = '#E8120C';
const FREE_PULSE_MS = 1600;

/**
 * A halo that keeps breathing out of a corner tag so it reads before anything
 * else on the card. Its own view rather than a shadow because Android can't
 * tint an elevation shadow red.
 */
function PulseHalo() {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled || reduceMotion) return;
      loop = Animated.loop(
        Animated.timing(pulse, {
          toValue: 1,
          duration: FREE_PULSE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        })
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [pulse]);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.tagHalo,
        {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [
            { scaleX: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) },
            { scaleY: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) },
          ],
        },
      ]}
    />
  );
}

/** A stamp on the card's top-right corner: "FREE", or the activity's price. */
function CornerTag({ label, pulses }: { label: string; pulses: boolean }) {
  return (
    <View style={styles.tagWrap} pointerEvents="none">
      {pulses && <PulseHalo />}
      <View style={styles.tag}>
        <Text style={styles.tagText}>{label}</Text>
      </View>
    </View>
  );
}

export function ActivityCard({
  name,
  tagline,
  art,
  width,
  tag,
  tagPulses = false,
  onPress,
}: {
  name: string;
  /** The card's second line — Home's "Unlock Your Table", a game's price and length. */
  tagline: string;
  art: ImageSourcePropType;
  width: number;
  /** Corner stamp text, e.g. "FREE" or "₹126". */
  tag?: string;
  tagPulses?: boolean;
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
      accessibilityLabel={`${name}. ${tag ? `${tag}. ` : ''}${tagline}`}
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
      {tag && <CornerTag label={tag} pulses={tagPulses} />}
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
  tagWrap: {
    position: 'absolute',
    top: -7,
    right: -5,
    transform: [{ rotate: '-8deg' }],
  },
  tagHalo: {
    backgroundColor: BRAND_RED,
    borderRadius: 4,
  },
  tag: {
    backgroundColor: BRAND_RED,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    shadowColor: BRAND_RED,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  tagText: {
    color: '#FFFDF8',
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 1.6,
    fontFamily: FontFamily.body.bold,
  },
});
