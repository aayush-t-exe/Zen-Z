import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { AuthPalette as Palette } from '@/constants/auth-palette';
import {
  FLOW_CHECK_ASPECT,
  FLOW_CHECK_RIGHT,
  FLOW_CHECK_W,
  FLOW_PANEL_RATIO,
  FLOW_ROW_SCALE,
  FlowText,
} from '@/constants/flow-theme';

/**
 * The redesign's one row surface, and the four things built on it.
 *
 * Every comp draws the same box for an option, a text field and a settings
 * row, so they all come from the designer's panel art here rather than a
 * coded border — the art carries the lit top edge and the fill ramp that a
 * `borderWidth` can't. `width` is required throughout: an `<Image>` given
 * `StyleSheet.absoluteFill` ignores it and lays out at its intrinsic pixel
 * size instead (902dp here — several times the screen width), so the art can
 * only be sized against a real number the caller already has from
 * `useWindowDimensions`.
 */

/** Height the art wants for a given column width. Exported for callers laying out around a row. */
export const flowRowHeight = (width: number) => width * FLOW_PANEL_RATIO * FLOW_ROW_SCALE;

/** Breathing room between the end of a label and the selected tick. */
const TICK_GAP = 12;

/**
 * How much room the right side of a selectable row has to keep clear: the
 * tick's inset from the edge, plus the tick itself, plus a gap.
 *
 * Derived rather than a fixed number because both of those are fractions of
 * the row's width — a hardcoded padding only ever happens to clear the tick
 * at one column width, and at a real 390pt handset's 322dp column a flat
 * 50dp left the tick sitting 6.8dp inside the text.
 *
 * Reserved whether or not the row is currently selected, so picking one
 * doesn't reflow its label.
 */
export const flowTickClearance = (width: number) =>
  width * FLOW_CHECK_RIGHT + width * FLOW_CHECK_W + TICK_GAP;

/**
 * The bare surface: panel art behind children.
 *
 * The box grows past the art's own aspect when its content needs the room —
 * the art's height is only a floor. The personality quiz needs that: its
 * option labels are whole sentences (the longest active one is 77
 * characters, which is three lines in a 322dp column), where every comp that
 * produced this art only ever had to hold something like "Under ₹200". A
 * fixed-aspect row silently truncated them.
 *
 * Stretching costs some corner fidelity — the art's corner is a ~30px radius
 * inside a 902x154 box, so a row drawn 1.5x its natural height gets corners
 * about 1.5x taller than wide. That is a small, soft feature of the shape and
 * it reads as the same box; a clipped answer does not. Pass an explicit
 * `height` where content can't wrap anyway (a single-line field) to keep the
 * art exactly on its aspect.
 */
export function FlowSurfaceBox({
  width,
  height,
  children,
  style,
}: {
  width: number;
  height?: number;
  children?: React.ReactNode;
  style?: object;
}) {
  const naturalHeight = flowRowHeight(width);
  return (
    <View
      style={[
        height !== undefined ? { width, height } : { width, minHeight: naturalHeight },
        style,
      ]}>
      {/* Explicit width plus a percentage height, not StyleSheet.absoluteFill:
          an <Image> given only absolute insets ignores them and lays out at
          its intrinsic pixel size (902dp), which is several times the screen
          width. */}
      <Image
        source={require('@/assets/images/booking-flow-panel.png')}
        style={[styles.art, { width }]}
        resizeMode="stretch"
        accessibilityIgnoresInvertColors
      />
      {children}
    </View>
  );
}

/**
 * The filled tick a selected row carries, at the slot row's own size and
 * inset. Centred by a full-height absolute column rather than a computed
 * `top`, so it stays centred in a row whose height follows its label.
 */
function SelectedTick({ width }: { width: number }) {
  const checkSize = width * FLOW_CHECK_W;
  return (
    <View style={[styles.tickColumn, { right: width * FLOW_CHECK_RIGHT }]} pointerEvents="none">
      <Image
        source={require('@/assets/images/icon-check-filled.png')}
        style={{ width: checkSize, height: checkSize * FLOW_CHECK_ASPECT }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/**
 * The row every option-picking step selects from — the booking flow's budget
 * and group-preference steps, profile creation's year and gender steps, and
 * the quiz's single-select questions.
 *
 * No comp draws a selected state — all three panels are pixel-identical in
 * every one of them — so selection reuses the slot row's filled tick rather
 * than inventing a second selection language mid-flow.
 */
export function FlowPanel({
  label,
  selected,
  onPress,
  width,
  align = 'center',
  dimmed = false,
  multiSelect = false,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  width: number;
  /**
   * Short labels centre, the way every comp draws them. Pass 'left' for a
   * list of full sentences — the personality quiz's answers run to three
   * lines, and centred ragged text that long reads as verse, not options.
   */
  align?: 'center' | 'left';
  /** True when a sibling in this list is selected and this one is not — fades this row so the pick stands out. */
  dimmed?: boolean;
  /** Reports as a checkbox rather than a radio, for multi-select questions. */
  multiSelect?: boolean;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const clearance = flowTickClearance(width);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(dimmed ? 0.35 : 1, { duration: 220 }),
  }));

  return (
    <Animated.View style={fadeStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={disabled}
        accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
        accessibilityState={{ selected, checked: selected, disabled }}
        accessibilityLabel={label}
        style={{ opacity: pressed ? 0.82 : 1 }}>
        <FlowSurfaceBox width={width}>
          <View
            style={[
              align === 'left' ? styles.rangedContent : styles.centredContent,
              // Symmetric on a centred label so it stays optically centred in
              // the row, one-sided on a ranged one so it keeps the full left
              // margin for its first character.
              align === 'left'
                ? { paddingRight: clearance }
                : { paddingLeft: clearance, paddingRight: clearance },
            ]}>
            <Text style={[FlowText.panelLabel, align === 'left' && styles.rangedLabel]}>
              {label}
            </Text>
          </View>
        </FlowSurfaceBox>
        {selected && <SelectedTick width={width} />}
      </Pressable>
    </Animated.View>
  );
}

/**
 * A tappable row that navigates or acts rather than selecting — the profile
 * tab's settings list. `tone="danger"` is for Sign Out and Delete Account,
 * which tint their label rather than swapping the surface: the comps only
 * ever draw the one box.
 */
export function FlowActionRow({
  label,
  onPress,
  width,
  tone = 'default',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  width: number;
  tone?: 'default' | 'danger';
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
      style={{ opacity: disabled ? 0.5 : pressed ? 0.82 : 1 }}>
      <FlowSurfaceBox width={width}>
        <View style={styles.centredContent}>
          <Text style={[FlowText.panelLabel, tone === 'danger' && { color: Palette.error }]}>
            {label}
          </Text>
        </View>
      </FlowSurfaceBox>
    </Pressable>
  );
}

/**
 * A text field on the same surface. Left-ranged rather than centred like an
 * option row's label — a caret that starts mid-row and drifts as you type
 * reads as broken, and the flow's own +1 name field is left-ranged too.
 */
export function FlowField({
  width,
  style,
  ...inputProps
}: TextInputProps & { width: number; style?: object }) {
  return (
    // Explicit height: a single-line field can't wrap, so the art stays
    // exactly on its own aspect here.
    <FlowSurfaceBox width={width} height={flowRowHeight(width)} style={style}>
      <TextInput
        placeholderTextColor={Palette.placeholder}
        {...inputProps}
        style={[StyleSheet.absoluteFill, styles.fieldInput]}
      />
    </FlowSurfaceBox>
  );
}

/**
 * A field that opens something instead of accepting typing — the Android date
 * picker's trigger. Shows `placeholder` in the placeholder color until
 * `value` is set.
 */
export function FlowFieldButton({
  value,
  placeholder,
  onPress,
  width,
  disabled = false,
}: {
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  width: number;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={value || placeholder}
      style={{ opacity: disabled ? 0.5 : pressed ? 0.82 : 1 }}>
      <FlowSurfaceBox width={width} height={flowRowHeight(width)}>
        <View style={styles.fieldContent}>
          <Text
            style={[FlowText.fieldText, !value && { color: Palette.placeholder }]}
            numberOfLines={1}>
            {value || placeholder}
          </Text>
        </View>
      </FlowSurfaceBox>
    </Pressable>
  );
}

const FIELD_PADDING = 24;

const styles = StyleSheet.create({
  art: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
  },
  tickColumn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  // Laid out in flow, not absolutely, so the row's height follows its label.
  // Horizontal padding comes from flowTickClearance at the use site, since it
  // has to track the tick's width-relative geometry. FlowActionRow keeps the
  // flat 54 below instead: it never draws a tick, so making it reserve that
  // room would only cost it label width.
  centredContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 54,
    paddingVertical: 14,
  },
  // Sentence-length labels keep the full left margin for their first
  // character, and drop to the slot row's smaller size so a typical answer
  // still fits in two lines.
  rangedContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingLeft: 22,
    paddingVertical: 15,
  },
  rangedLabel: {
    fontSize: 15,
    lineHeight: 21,
  },
  fieldContent: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: FIELD_PADDING,
  },
  fieldInput: {
    ...FlowText.fieldText,
    paddingHorizontal: FIELD_PADDING,
    // A TextInput filling the row centres its own text vertically on iOS but
    // not on Android, where it needs the padding zeroed and the line box left
    // to do it instead.
    paddingVertical: 0,
    textAlignVertical: 'center',
  },
});
