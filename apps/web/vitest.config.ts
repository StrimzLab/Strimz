import { defineConfig } from 'vitest/config'

/**
 * Vitest only runs unit / integration tests.
 *
 * Playwright end-to-end specs live in `tests/e2e/**` and are driven by
 * `pnpm test:e2e` (which invokes `playwright test`). Vitest's default
 * glob would otherwise pick them up because they share the `*.spec.ts`
 * suffix and immediately fail with "Playwright Test did not expect
 * test() to be called here".
 */
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', 'tests/e2e/**'],
  },
})
