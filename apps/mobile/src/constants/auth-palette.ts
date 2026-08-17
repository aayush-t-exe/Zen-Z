/**
 * Palette for the pre-login screens (onboarding, email, OTP).
 *
 * These screens run their own charcoal/cream art direction, sampled from the
 * approved design boards. The signed-in app is still on `theme.ts` — do not
 * reach for these values there.
 *
 * `canvas` was `#1E2128` (the charcoal in the phone mockups) before the founder
 * asked for pure black; that is the value to restore if black is rejected.
 */
export const AuthPalette = {
  /** Page background. */
  canvas: '#000000',
  /** Cream fill for primary buttons and input surfaces. */
  paper: '#E9E3D5',
  /** Slate ring drawn just outside the cream pill. */
  ring: '#8C8F96',
  /** Ink used for button labels and typed digits. */
  line: '#16181D',
  /** Body and heading copy. */
  text: '#EDE8DC',
  /** Secondary copy. */
  muted: '#C9C4B8',
  /** Inactive page dots. */
  dotIdle: '#6E7078',
  /** Interior of the drawn input bubble. */
  field: '#FAF5ED',
  /** Text typed into the bubble. */
  fieldInk: '#3A3A3C',
  /** Placeholder inside the bubble. */
  placeholder: '#8C8681',
  /** Error copy, warm enough not to fight the palette. */
  error: '#F08C7E',
} as const;
