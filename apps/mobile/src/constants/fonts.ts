/**
 * Two-family type system: Fraunces for display/headline copy (the
 * mysterious/adventurous tone — screen titles, onboarding, match reveal),
 * Instrument Sans for body/UI copy (buttons, labels, quiz questions,
 * descriptions — legibility at small sizes over character).
 *
 * These are exact `expo-font` family names, one per static weight instance
 * — React Native doesn't swap font files based on a `fontWeight` style the
 * way the web does, so any style that needs a specific weight must set the
 * matching `fontFamily` from this map directly, not rely on `fontWeight`
 * alone.
 *
 * `accent` holds fonts the redesigned home screen's approved comp called for
 * by name (Sitka, Inter, SF Pro Display) that don't fit the two-family
 * system above — kept separate rather than folded into `display`/`body` so
 * it's obvious they're a deliberate one-off, not the project default. Sitka
 * ships here as a static "Display" optical-size instance sliced from the
 * variable font already on Windows (`C:\Windows\Fonts\SitkaVF.ttf`) via
 * `fonttools varLib.instancer` — React Native has no variable-font-axis API,
 * so the variable file itself can't be loaded directly. SF Pro Display is
 * subset to Latin + common punctuation only (`fonttools subset`) — the full
 * Apple-supplied .otf is ~6MB per weight because of its huge non-Latin/symbol
 * glyph coverage; subsetting brings each weight actually used here under
 * 80KB. [ASSUMPTION] shipping SF Pro Display in this bundle is outside what
 * Apple's font license permits (it restricts the font to Apple's own
 * platform tooling) — the founder made this call explicitly, accepting that
 * risk, after being told the license doesn't cover this use.
 */
export const FontFamily = {
  display: {
    regular: 'Fraunces_400Regular',
    medium: 'Fraunces_500Medium',
    semiBold: 'Fraunces_600SemiBold',
    bold: 'Fraunces_700Bold',
  },
  body: {
    regular: 'InstrumentSans_400Regular',
    regularItalic: 'InstrumentSans_400Regular_Italic',
    medium: 'InstrumentSans_500Medium',
    mediumItalic: 'InstrumentSans_500Medium_Italic',
    semiBold: 'InstrumentSans_600SemiBold',
    bold: 'InstrumentSans_700Bold',
  },
  accent: {
    // The budget step's comp sets its heading much lighter than the slot
    // step's: stem/cap 0.160 against 0.220, which is Inter Medium exactly.
    interMedium: 'Inter_500Medium',
    interBold: 'Inter_700Bold',
    // The booking flow's headings measure stem/cap 0.220 in the comp — exactly
    // between Inter Bold (0.200) and ExtraBold (0.240). ExtraBold is the closer
    // read at the larger size the founder asked for.
    interExtraBold: 'Inter_800ExtraBold',
    interBlack: 'Inter_900Black',
    sitkaDisplay: 'SitkaDisplay_400Regular',
    sitkaDisplayBold: 'SitkaDisplay_700Bold',
    sfProDisplayThin: 'SFProDisplay_100Thin',
    sfProDisplayLight: 'SFProDisplay_300Light',
    sfProDisplayMedium: 'SFProDisplay_500Medium',
    sfProDisplayRegularItalic: 'SFProDisplay_400Regular_Italic',
  },
} as const;
