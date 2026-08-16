/**
 * Zen-Z visual system tokens.
 *
 * Three groups, and the distinction matters:
 *
 *  - `Palette` holds fixed brand values. These never follow the colour
 *    scheme. Marigold is marigold on a dark ground too, because it is
 *    welded to "Café", not to "light mode".
 *  - `Colors.light` / `Colors.dark` hold the roles that *do* flip.
 *  - `ActivityColor` maps `activity_types.icon_key` to its hue.
 *
 * House rule that keeps a seven-value palette from reading as rainbow:
 * at most two accent hues may be visible on any one screen. Each accent
 * carries exactly one meaning, so a second unrelated accent is always
 * decoration.
 */

import '@/global.css';

export const Palette = {
  /** Chalky pale oat. The light ground. Deliberately not off-white. */
  notebook: '#ECEAD9',
  /** Warm near-black. Every outline, all body text, the dark ground. Never #000. */
  ink: '#171612',
  /** Café, and the primary action colour everywhere else. */
  marigold: '#F2B12C',
  /** Dinner, and destructive actions (cancel, report). */
  sindoor: '#E4573D',
  /** Movie. The only cool hue, which is what makes it easy to spot. */
  cobalt: '#2E63C8',
  /** The 48h reveal moment, and nothing else. Its rarity is the point. */
  bubblegum: '#EC6FA6',
  /** Paid / confirmed. Badges only, never a full surface. */
  paan: '#4C9A5E',
} as const;

/**
 * Keyed by `activity_types.icon_key`. Adding a fourth activity is a row
 * insert plus one entry here and one glyph in components/icon.tsx.
 */
export const ActivityColor: Record<string, string> = {
  cafe: Palette.marigold,
  dinner: Palette.sindoor,
  movie: Palette.cobalt,
};

/** Foreground that stays legible on a given activity fill. */
export const ActivityInk: Record<string, string> = {
  cafe: Palette.ink,
  dinner: Palette.ink,
  movie: Palette.notebook,
};

export const Colors = {
  light: {
    text: Palette.ink,
    background: Palette.notebook,
    /** Raised surface: cards, sheets. */
    backgroundElement: '#F5F3E6',
    backgroundSelected: '#E1DFCC',
    textSecondary: '#5C594E',
    /** Every border in the system. */
    outline: Palette.ink,
    /** Text on a surface that is always light regardless of scheme. */
    onLight: Palette.ink,
    /** Text on an inverted surface. */
    invertedText: Palette.notebook,
    error: Palette.sindoor,
    warning: '#8A5A12',
  },
  dark: {
    text: Palette.notebook,
    background: Palette.ink,
    backgroundElement: '#211F1A',
    backgroundSelected: '#2B2823',
    textSecondary: '#9A9585',
    outline: Palette.notebook,
    onLight: Palette.ink,
    invertedText: Palette.ink,
    error: Palette.sindoor,
    warning: '#F2B12C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Loaded in app/_layout.tsx. The split is meaningful, not stylistic:
 * `mono` is for facts the system knows exactly (times, countdowns,
 * booking codes, prices) and never for anything a person wrote.
 */
export const Fonts = {
  display: 'Gabarito_800ExtraBold',
  body: 'HankenGrotesk_400Regular',
  bodyMedium: 'HankenGrotesk_500Medium',
  bodySemi: 'HankenGrotesk_600SemiBold',
  mono: 'MartianMono_600SemiBold',
} as const;

/**
 * Flat cut or full pill, with nothing in the 8-20 range that reads as a
 * framework default. `sheet` is only ever applied to the top two corners
 * of a bottom sheet.
 */
export const Radius = {
  flat: 0,
  card: 4,
  sheet: 28,
  pill: 999,
} as const;

/** Outline carries elevation in this system. Shadow is the exception, not the rule. */
export const OUTLINE_WIDTH = 2.5;

/**
 * Hard offset shadow, zero blur. Permitted on exactly two things: the
 * primary action on a screen, and the active tab in the nav. React Native
 * cannot draw an unblurred offset shadow on Android (elevation always
 * blurs), so components render it as an offset sibling View instead of a
 * shadow style. See components/hard-shadow.tsx.
 */
export const HARD_SHADOW_OFFSET = 3;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = 96;
export const MaxContentWidth = 800;
