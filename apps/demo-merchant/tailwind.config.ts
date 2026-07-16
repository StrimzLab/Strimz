import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f4',
          100: '#ffe0e7',
          200: '#ffc6d3',
          300: '#ff97b0',
          400: '#ff5f85',
          500: '#ff2b62',
          600: '#ed0e4a',
          700: '#c8073d',
          800: '#a60937',
          900: '#8a0d32',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
