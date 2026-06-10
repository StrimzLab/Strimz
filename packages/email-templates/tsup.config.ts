import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  // Bundle everything except react / @react-email so they remain peer
  // deps. The consumer apps already pull both.
  external: ['react', /^@react-email\//],
})
