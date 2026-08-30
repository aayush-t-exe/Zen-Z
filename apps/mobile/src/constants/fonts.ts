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
    medium: 'InstrumentSans_500Medium',
    semiBold: 'InstrumentSans_600SemiBold',
    bold: 'InstrumentSans_700Bold',
  },
} as const;
