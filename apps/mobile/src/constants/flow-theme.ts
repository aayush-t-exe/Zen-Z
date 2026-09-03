/**
 * The redesign's art direction, shared by every screen rebuilt against the
 * approved comps (Home, the booking flow, profile creation, the personality
 * quiz, the profile tab).
 *
 * These screens are drawn from designer-supplied PNG art rather than coded
 * borders and fills, so the numbers here are geometry as much as they are
 * style. Every comp is 1170x2532 — a 390pt screen at @3x — so comp pixels
 * divide by 3 to give the dp values below.
 *
 * The typography is deliberately *not* the project's Fraunces/Instrument Sans
 * two-family system (see constants/fonts.ts): the comps call for Inter and SF
 * Pro Display by name, which is why those live under `FontFamily.accent`.
 * Anything using `FlowText` is on the redesign; anything still reaching for
 * `FontFamily.display`/`FontFamily.body` is not yet.
 */
import { StyleSheet } from 'react-native';

import { AuthPalette as Palette } from './auth-palette';
import { FontFamily } from './fonts';

/** Side margin on the flow screens — wider than Home's 21dp. */
export const FLOW_SIDE_PADDING = 34;
/** Content column never grows past this, so tablets don't stretch the art. */
export const FLOW_CONTENT_MAX = 358;

/** Panel art aspect (booking-flow-panel.png is a plain 902x154 box). */
export const FLOW_PANEL_RATIO = 154 / 902;
/**
 * Every comp draws its row 154px tall; the founder asked for a taller row, so
 * this scales all of them past the art's natural aspect together. Applied
 * uniformly or the boxes visibly shrink between one step and the next.
 */
export const FLOW_ROW_SCALE = 1.12;
/** booking-next-pill.png aspect. */
export const FLOW_PILL_RATIO = 145 / 902;
/**
 * Height for a pill that stretches to its parent instead of being handed a
 * column width. 54dp is what FLOW_PILL_RATIO works out to at the column
 * widths these screens actually use, and it is also the height the pre-login
 * screens' previous button ran at, so the footers do not shift.
 */
export const FLOW_PILL_HEIGHT = 54;

/** The filled tick's size and inset, as fractions of the row's width. */
export const FLOW_CHECK_W = 15 / 300.3;
export const FLOW_CHECK_RIGHT = 38 / 300.3;
/** icon-check-filled.png is 120x116. */
export const FLOW_CHECK_ASPECT = 116 / 120;

/**
 * The panel art's own colors, for the few surfaces that have to be coded
 * rather than drawn — a compact chip can't use the art, because stretching a
 * 902x154 box down to chip proportions turns its rounded corners elliptical.
 *
 * The art's stroke runs #FFFFFF at the top to #AFAFAF at the bottom over a
 * fill that ramps #0A0A0A to #151515. `stroke` is dimmer than any of that on
 * purpose: the art's stroke is 1px inside a 902px-wide image, so by the time
 * it's stretched to a ~300dp column it lands sub-pixel and renders as a soft
 * antialiased line. A coded 1dp border at the art's literal value reads far
 * heavier than the thing it's meant to match.
 */
export const FlowSurface = {
  fill: '#101010',
  stroke: '#6A6A6A',
  /** Ink for anything sitting on the cream pill or a selected surface. */
  ink: '#1D1D1B',
} as const;

/**
 * Tracking runs at roughly -0.04em across the redesign's headings (the slot
 * step's 27dp heading carries -1.08), so a heading set at another size keeps
 * the same optical tightness by scaling with it rather than picking a number.
 */
export const flowTracking = (fontSize: number) => fontSize * -0.04;

export const FlowText = StyleSheet.create({
  /**
   * The centred hero the pre-login screens lead with — the Jaipur reveal, the
   * email prompt, the OTP prompt. Same family and tracking ratio as `title`,
   * just given the room those screens have; a screen that wants a different
   * size overrides `fontSize` and `letterSpacing` with flowTracking().
   */
  display: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.36,
    textAlign: 'center',
    fontFamily: FontFamily.accent.interExtraBold,
  },
  /** A quiet tappable line under a primary action ("Already in? Continue"). */
  link: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
  /**
   * The left-ranged screen heading. Inter Bold in the comp measures stem/cap
   * 0.220 — exactly between Inter Bold (0.200) and ExtraBold (0.240);
   * ExtraBold is the closer read at the size the founder asked for. Sized off
   * the comp's 16.7dp cap (22.5dp at Inter's 0.727 cap ratio) then scaled
   * ~1.2x on request, since the comp's type read too small on a handset.
   * Leading is near-solid and tracking tight — the comp's "When do you want
   * your" runs 243dp where untracked Inter ExtraBold runs 262dp.
   */
  title: {
    color: '#FFFFFF',
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -1.08,
    fontFamily: FontFamily.accent.interExtraBold,
  },
  /**
   * The centred heading the option-picking steps use. Its comp measures
   * stem/cap 0.160 and x-height/cap 0.740, which is Inter Medium exactly (SF
   * Pro would be 0.720, and would need positive tracking to reach the comp's
   * width). Same size as `title` — both comps set a 16.7dp cap.
   */
  titleCentred: {
    color: '#FFFFFF',
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -0.44,
    textAlign: 'center',
    fontFamily: FontFamily.accent.interMedium,
  },
  /** A step heading that has to share the screen with a tall control. */
  titleCompact: {
    color: '#FFFFFF',
    fontSize: 23,
    lineHeight: 27,
    letterSpacing: -0.9,
    fontFamily: FontFamily.accent.interExtraBold,
  },
  /** Sized off the comp's 7.3dp cap. Upright Thin, as the slot step sets it. */
  subtitle: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontFamily: FontFamily.accent.sfProDisplayThin,
  },
  /**
   * Same 7.3dp cap, but Regular Italic rather than upright Thin — the option
   * steps' comps run stem/cap 0.143 against the slot step's 0.095, obliqued.
   */
  subtitleItalic: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    fontFamily: FontFamily.accent.sfProDisplayRegularItalic,
  },
  /** Sized off the comp's 9.33dp cap — larger than a slot row's label. */
  panelLabel: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
  /** The slot row's own label, off its 8.0dp cap. */
  rowLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
  /** Label on the cream pill primary action. */
  pillLabel: {
    color: FlowSurface.ink,
    fontSize: 18,
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
  backLabel: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
  /** Quiet group heading above a run of rows. */
  sectionLabel: {
    color: Palette.muted,
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
  /** Typed input, and the placeholder that precedes it. */
  fieldText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
  /** Small print — the photo-privacy line, the version string. */
  fine: {
    color: Palette.muted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
  error: {
    color: Palette.error,
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
    fontFamily: FontFamily.accent.sfProDisplayMedium,
  },
});
