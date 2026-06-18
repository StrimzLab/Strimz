import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/react/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: 'es2022',
  outDir: 'dist',
  external: ['react', 'react-dom', '@stellar/stellar-sdk', '@noble/hashes'],
})
