import { defineConfig } from 'vitest/config'

// Kills and restarts services, so it never shares a run with the other suites.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['chaos/**/*.chaos.test.ts'],
    testTimeout: 600_000,
    hookTimeout: 600_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    globalSetup: ['./src/global-setup.ts'],
  },
})
