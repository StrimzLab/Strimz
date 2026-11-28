import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMDX } from 'fumadocs-mdx/next'
import { baseNextConfig } from '../../packages/web-shared/next/base-config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Absolute paths so the config also loads from another directory (tests).
const withMDX = createMDX({
  configPath: path.join(__dirname, 'source.config.ts'),
  outDir: path.join(__dirname, '.source'),
})

/** @type {import('next').NextConfig} */
const config = {
  // Fumadocs MDX generates `.source` at the project root, outside `src/`.
  ...baseNextConfig({ aliases: { '@/.source': path.resolve(__dirname, '.source') } }),
  redirects() {
    return Promise.resolve([
      { source: '/', destination: '/docs', permanent: true },
      // The self-hosting pages were removed (#586).
      { source: '/docs/self-hosting/:path*', destination: '/docs', permanent: true },
    ])
  },
}

export default withMDX(config)
