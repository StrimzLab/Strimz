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
        gold: '#ffb020',
        ink: 'hsl(var(--fg) / <alpha-value>)',
        paper: 'hsl(var(--bg) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        line: 'hsl(var(--border) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
