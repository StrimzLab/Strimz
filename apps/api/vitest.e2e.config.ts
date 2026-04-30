import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'

/**
 * E2E test runner.
 *
 * - Spawns a Postgres container via testcontainers in `globalSetup`,
 *   applies Prisma migrations, exposes the URL through `process.env`.
 * - Forces a single fork so the suite runs serially against the shared DB
 *   (each test truncates between cases via `db-helper.ts`).
 * - `unplugin-swc` rewires TS transformation to preserve decorator metadata
 *   (`emitDecoratorMetadata`) — required for NestJS's reflective DI to find
 *   constructor param types under vitest. Without this every `@Injectable`
 *   constructor receives `undefined` arguments.
 *
 * Run with:    pnpm --filter @strimz/api test:e2e
 * In CI:       same command — testcontainers brings its own service container.
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
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    globalSetup: ['./test/setup/global-setup.ts'],
  },
})
