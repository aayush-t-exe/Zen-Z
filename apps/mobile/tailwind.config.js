/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        // Regular-weight base for each family. React Native doesn't swap
        // font files based on `font-bold`/`font-semibold` the way the web
        // does with a single variable file, so heavier weights get their
        // own explicit utility pointing straight at that weight's static
        // instance — use these instead of pairing font-display/font-body
        // with font-bold etc.
        display: ['Fraunces_400Regular'],
        'display-medium': ['Fraunces_500Medium'],
        'display-semibold': ['Fraunces_600SemiBold'],
        'display-bold': ['Fraunces_700Bold'],
        body: ['InstrumentSans_400Regular'],
        'body-medium': ['InstrumentSans_500Medium'],
        'body-semibold': ['InstrumentSans_600SemiBold'],
        'body-bold': ['InstrumentSans_700Bold'],
      },
    },
  },
  plugins: [],
};
