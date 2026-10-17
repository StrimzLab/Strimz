import { defineConfig } from 'vitest/config'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  define: { __SDK_VERSION__: JSON.stringify(pkg.version) },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    typecheck: {
      enabled: true,
      include: ['tests/**/*.test-d.ts'],
      tsconfig: './tsconfig.test.json',
    },
  },
})
