import type { Config } from 'tailwindcss';

// Palette: steel-plate neutrals + the four colours stainless steel turns as it
// is heated (straw -> bronze -> purple -> blue). Each level gets one tint.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        steel: {
          50: '#F3F5F7', 100: '#E7EBEE', 200: '#D3D9DF', 300: '#B5BEC7',
          500: '#6B7886', 700: '#37434E', 900: '#1B242C',
        },
        tint: { 1: '#D9A93F', 2: '#C9732B', 3: '#7A4FA3', 4: '#2F5FB3' },
        ok: '#2E7D5B',
        bad: '#B3412F',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', '"Arial Narrow"', 'ui-sans-serif', 'sans-serif'],
        sans: ['Barlow', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
