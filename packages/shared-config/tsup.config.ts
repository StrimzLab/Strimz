import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/chains.ts',
    'src/tokens.ts',
    'src/tiers.ts',
    'src/webhooks.ts',
    'src/api-keys.ts',
    'src/agents.ts',
    'src/cctp.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  outDir: 'dist',
})
