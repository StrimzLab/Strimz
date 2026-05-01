import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'

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
