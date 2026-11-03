import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#14181f', soft: '#4b5563', faint: '#8a93a1' },
        line: '#e6e8ec',
        paper: '#ffffff',
        wash: '#f7f8fa',
        brand: { DEFAULT: '#1f3a5f', dark: '#16294a' },
        ok: { DEFAULT: '#15803d', bg: '#e8f5ec' },
        retake: { DEFAULT: '#b45309', bg: '#fdf1dd' },
        review: { DEFAULT: '#1d4ed8', bg: '#e8eefc' },
        bad: { DEFAULT: '#b42318', bg: '#fdeceb' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans', 'Noto Sans Devanagari', 'sans-serif'],
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
} satisfies Config;
