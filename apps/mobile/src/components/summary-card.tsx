import { useState } from 'react';
import { View, Text, Pressable, Image, StyleSheet, type ImageSourcePropType } from 'react-native';

import { FlowText } from '@/constants/flow-theme';
import { FlowSurfaceBox } from '@/components/flow-panel';

/**
 * The booking flow's confirmation card, measured off the approved comp
 * (Desktop/UI/UI PAGE 5, "zen z ui 5.jpg.jpeg"). That file is 1170x2532 — a
 * 390pt screen at @3x — so comp pixels divide by 3 for dp.
 *
 * The card is one piece of art (summary-card.png, 942x899) with its three
 * dividers already drawn in, and they are NOT evenly spaced: measured off the
 * art itself they sit at 0.248 / 0.503 / 0.735 of its height. So the row
 * content is positioned to those fractions rather than laid out in a flex
 * column — a column with even rows drifts off the drawn lines. That also
 * means the card holds exactly four rows: there is no art for three or five.
 *
 * Every horizontal position below is a fraction of the drawn art's width,
 * derived from the comp's own card (930px wide, its box inset 6px inside the
 * 942px canvas) so the geometry holds at any column width.
 */

/** Art aspect: 899 / 942. */
export const SUMMARY_CARD_RATIO = 899 / 942;

/** Where the art draws its dividers, as fractions of its height. */
const DIVIDERS = [223 / 899, 452 / 899, 661 / 899];

const BADGE_LEFT = 0.0903;
/** The badge art's full canvas (summary-badge.png keeps a 4px margin). */
const BADGE_CANVAS = 0.1594;

/**
 * What SummaryBadge occupies at a given card width. Exported for the screens
 * that seat one in a row of their own (Bookings, Messages, Booking Details)
 * and need to indent something else to the same column.
 */
export const summaryBadgeSize = (cardWidth: number) => cardWidth * BADGE_CANVAS;
/** The visible circle inside that canvas — what the glyph is sized against. */
const BADGE_CIRCLE = 0.1509;
const LABEL_LEFT = 0.2805;
const CHEVRON_RIGHT = 0.1273;
const CHEVRON_W = 0.0287;
/** icon-chevron-right.png is 27x47. */
const CHEVRON_ASPECT = 47 / 27;
/** icon-tick.png is 42x31. */
const TICK_W = 0.0452;
const TICK_ASPECT = 31 / 42;

/**
 * Each glyph is drawn at its own size in the comp rather than one shared
 * inset — the plated-dinner mark carries its own ring so it runs nearly to
 * the badge edge, while the money bag sits well inside. Measured per glyph as
 * a fraction of the visible badge circle.
 */
export const SUMMARY_ICONS = {
  dinners: { source: require('@/assets/images/icon-dinners-line.png'), scale: 0.7 },
  slot: { source: require('@/assets/images/icon-star-filled.png'), scale: 0.58 },
  group: { source: require('@/assets/images/icon-group-line.png'), scale: 0.65 },
  money: { source: require('@/assets/images/icon-money-line.png'), scale: 0.63 },
  gift: { source: require('@/assets/images/icon-gift-line.png'), scale: 0.49 },
} as const;

export interface SummaryIcon {
  source: ImageSourcePropType;
  /** Fraction of the badge circle the glyph fills. */
  scale: number;
}

export interface SummaryRow {
  icon: SummaryIcon;
  label: string;
  /** Second line under the label — the group row uses it for the gender preference. */
  detail?: string;
  /**
   * Jumps back to the step that set this choice. The comp draws a chevron on
   * every row, but one is only rendered where there is somewhere to go: the
   * activity is chosen before this flow starts, and the budget and preference
   * steps are skipped entirely for some activities. A chevron that does
   * nothing would promise a way back that isn't there.
   */
  onPress?: () => void;
}

/** The dark circle behind a row's glyph, with the glyph centred in it. */
export function SummaryBadge({ cardWidth, icon }: { cardWidth: number; icon: SummaryIcon }) {
  const canvas = cardWidth * BADGE_CANVAS;
  const glyph = cardWidth * BADGE_CIRCLE * icon.scale;
  return (
    <View style={{ width: canvas, height: canvas, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={require('@/assets/images/summary-badge.png')}
        style={{ position: 'absolute', width: canvas, height: canvas }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Image
        source={icon.source}
        style={{ width: glyph, height: glyph }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

function CardRow({
  row,
  cardWidth,
  top,
  height,
}: {
  row: SummaryRow;
  cardWidth: number;
  top: number;
  height: number;
}) {
  const [pressed, setPressed] = useState(false);
  const chevronW = cardWidth * CHEVRON_W;

  const body = (
    <View style={[styles.row, { paddingLeft: cardWidth * BADGE_LEFT }]}>
      <SummaryBadge cardWidth={cardWidth} icon={row.icon} />
      <View
        style={{
          position: 'absolute',
          left: cardWidth * LABEL_LEFT,
          right: cardWidth * (CHEVRON_RIGHT + CHEVRON_W) + 10,
        }}>
        <Text style={FlowText.panelLabel} numberOfLines={row.detail ? 1 : 2}>
          {row.label}
        </Text>
        {row.detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {row.detail}
          </Text>
        ) : null}
      </View>
      {row.onPress ? (
        <Image
          source={require('@/assets/images/icon-chevron-right.png')}
          style={{
            position: 'absolute',
            right: cardWidth * CHEVRON_RIGHT,
            width: chevronW,
            height: chevronW * CHEVRON_ASPECT,
          }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );

  const frame = { position: 'absolute' as const, left: 0, right: 0, top, height };

  if (!row.onPress) {
    return <View style={frame}>{body}</View>;
  }

  return (
    <Pressable
      onPress={row.onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={`${row.label}${row.detail ? `, ${row.detail}` : ''}. Change this.`}
      style={[frame, { opacity: pressed ? 0.6 : 1 }]}>
      {body}
    </Pressable>
  );
}

/** Exactly four rows — the art draws three dividers and no others fit. */
export function SummaryCard({
  rows,
  width,
  style,
}: {
  rows: [SummaryRow, SummaryRow, SummaryRow, SummaryRow];
  width: number;
  style?: object;
}) {
  const height = width * SUMMARY_CARD_RATIO;
  const bounds = [0, ...DIVIDERS, 1];

  return (
    <View style={[{ width, height }, style]}>
      <Image
        source={require('@/assets/images/summary-card.png')}
        style={{ width, height }}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
      />
      {rows.map((row, i) => (
        <CardRow
          key={i}
          row={row}
          cardWidth={width}
          top={bounds[i] * height}
          height={(bounds[i + 1] - bounds[i]) * height}
        />
      ))}
    </View>
  );
}

/**
 * The standalone row under the card — "Bring a +1" in the comp. Same badge
 * and label geometry as a card row, on the flow's own panel surface, with the
 * comp's bare tick when it is on.
 *
 * Height is the comp's own (65.7dp against its 310dp column) rather than the
 * panel art's natural aspect, which is too shallow to seat the badge.
 */
const TOGGLE_RATIO = 65.7 / 310;

export function SummaryToggleRow({
  label,
  icon,
  selected,
  onPress,
  width,
  style,
}: {
  label: string;
  icon: SummaryIcon;
  selected: boolean;
  onPress: () => void;
  width: number;
  style?: object;
}) {
  const [pressed, setPressed] = useState(false);
  const tickW = width * TICK_W;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={[{ opacity: pressed ? 0.82 : 1 }, style]}>
      <FlowSurfaceBox width={width} height={width * TOGGLE_RATIO}>
        <View style={[styles.row, { paddingLeft: width * BADGE_LEFT }]}>
          <SummaryBadge cardWidth={width} icon={icon} />
          <Text
            style={[FlowText.panelLabel, { position: 'absolute', left: width * LABEL_LEFT }]}
            numberOfLines={1}>
            {label}
          </Text>
          {selected ? (
            <Image
              source={require('@/assets/images/icon-tick.png')}
              style={{
                position: 'absolute',
                right: width * CHEVRON_RIGHT,
                width: tickW,
                height: tickW * TICK_ASPECT,
              }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
      </FlowSurfaceBox>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detail: {
    ...FlowText.subtitle,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
});
