import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'browser-client': 'src/browser-client.ts',
    webhooks: 'src/webhooks.ts',
    errors: 'src/errors.ts',
    eip712: 'src/eip712/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  outDir: 'dist',
})
