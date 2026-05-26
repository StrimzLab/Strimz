import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/encoding.ts',
    'src/hash.ts',
    'src/hmac.ts',
    'src/random.ts',
    'src/timing-safe.ts',
    'src/webhook.ts',
    'src/api-key.ts',
    'src/aes-gcm.ts',
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
