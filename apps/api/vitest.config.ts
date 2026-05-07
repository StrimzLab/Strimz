import { defineConfig } from 'vitest/config'

/**
 * Unit-test config — only runs `test/unit/**`. The e2e suite under
 * `test/e2e/**` boots Nest + Postgres testcontainers and is driven by
 * `vitest.e2e.config.ts` via the `test:e2e` script. Including it here
 * would cause the unit run to fail on missing infra. Same scoping as
 * apps/scheduler and apps/agent.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/unit/**/*.test.ts'],
    globals: false,
    testTimeout: 30_000,
  },
})
