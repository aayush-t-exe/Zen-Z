import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#000000',
        surface: '#212225',
        'surface-selected': '#2E3135',
        ink: '#ffffff',
        'ink-muted': '#B0B4BA',
        line: '#2E3135',
        danger: '#ef4444',
        warn: '#fef08a',
      },
    },
  },
  plugins: [],
};

export default config;
