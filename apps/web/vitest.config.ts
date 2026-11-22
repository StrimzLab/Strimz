import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Playwright specs live in tests/e2e and run with `pnpm test:e2e`.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@strimz/web-shared': fileURLToPath(
        new URL('../../packages/web-shared/src', import.meta.url),
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.open-next/**',
      'tests/e2e/**',
    ],
  },
})
