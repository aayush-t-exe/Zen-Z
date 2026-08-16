/**
 * Zen-Z visual system, mirrored from src/constants/theme.ts.
 *
 * `borderRadius` deliberately REPLACES Tailwind's default scale instead of
 * extending it. The system allows flat-cut or full-pill and nothing in the
 * 8-20px range that reads as a framework default, so rounded-lg / -xl /
 * -2xl should not exist as options. Deleting them is what keeps that a
 * rule rather than a habit.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    borderRadius: {
      none: '0px',
      card: '4px',
      sheet: '28px',
      full: '9999px',
    },
    extend: {
      colors: {
        notebook: '#ECEAD9',
        ink: '#171612',
        marigold: '#F2B12C',
        sindoor: '#E4573D',
        cobalt: '#2E63C8',
        bubblegum: '#EC6FA6',
        paan: '#4C9A5E',
        plate: '#F5F3E6',
        'plate-sunk': '#E1DFCC',
        'plate-dark': '#211F1A',
        'plate-dark-sunk': '#2B2823',
        'ink-soft': '#5C594E',
        'cream-soft': '#9A9585',
      },
      fontFamily: {
        display: ['Gabarito_800ExtraBold'],
        body: ['HankenGrotesk_400Regular'],
        medium: ['HankenGrotesk_500Medium'],
        semi: ['HankenGrotesk_600SemiBold'],
        mono: ['MartianMono_600SemiBold'],
      },
      borderWidth: {
        outline: '2.5',
      },
    },
  },
  plugins: [],
};
