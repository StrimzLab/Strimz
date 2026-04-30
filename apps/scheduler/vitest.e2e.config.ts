import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'

/**
 * E2E config — spins Postgres + Redis containers, applies Prisma
 * migrations, and exercises workers end-to-end against the real BullMQ
 * runtime. SWC plugin is required so Nest's reflective DI can read
 * constructor types.
 */
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true, legacyDecorator: true },
        target: 'es2022',
        keepClassNames: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['test/e2e/**/*.e2e.test.ts'],
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 90_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    globalSetup: ['./test/setup/global-setup.ts'],
  },
})
