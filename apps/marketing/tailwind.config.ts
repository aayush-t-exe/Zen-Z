import type { Config } from 'tailwindcss';

// Tokens shared with the portfolio (S:\portfolio\src\app\globals.css), plus
// `butter` as the one sticker accent. Contrast notes live in globals.css.
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0A0908', 2: '#141210', 3: '#1D1A17' },
        paper: { DEFAULT: '#E9E3D5', 2: '#DFD8C8', 3: '#F3EEE3' },
        fg: '#EFE9DC',
        muted: '#A39E94',
        'paper-muted': '#5C564C',
        red: { DEFAULT: '#E10600', deep: '#A80400', text: '#FF3B30' },
        butter: '#F4C84A',
      },
      fontFamily: {
        display: ['var(--font-archivo)', 'Arial', 'sans-serif'],
        sans: ['var(--font-instrument)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
        hand: ['var(--font-caveat)', 'cursive'],
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.34,1.56,.64,1)',
        out: 'cubic-bezier(.23,1,.32,1)',
      },
      maxWidth: {
        page: '1240px',
        read: '680px',
      },
    },
  },
  plugins: [],
};

export default config;
