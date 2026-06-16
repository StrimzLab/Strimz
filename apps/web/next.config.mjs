import { createMDX } from 'fumadocs-mdx/next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  poweredByHeader: false,
  webpack: (cfg) => {
    cfg.resolve = cfg.resolve ?? {}
    cfg.resolve.alias = {
      ...(cfg.resolve.alias ?? {}),
      // Fumadocs MDX generates `.source` at the project root; resolve it
      // explicitly since `@/*` would otherwise look in `./src/*`.
      '@/.source': path.resolve(__dirname, '.source'),
      // `@metamask/sdk` (pulled in transitively by @wagmi/connectors)
      // imports `@react-native-async-storage/async-storage` for its React
      // Native code path. The browser bundle never executes that path, but
      // webpack still tries to resolve it at build time and emits a noisy
      // "Module not found" warning. Alias to `false` so webpack treats it
      // as an intentionally missing module — the import is behind a runtime
      // feature detect that's always false in browsers.
      '@react-native-async-storage/async-storage': false,
    }

    // Reown AppKit's wagmi adapter pulls Node-only optional deps. Mark
    // them as externals so the browser bundle doesn't try to resolve
    // their internals. Required per Reown's Next.js install guide.
    cfg.externals = cfg.externals ?? []
    cfg.externals.push('pino-pretty', 'lokijs', 'encoding')

    return cfg
  },
  typedRoutes: false,
  transpilePackages: [
    '@strimz/ui',
    '@strimz/sdk',
    '@strimz/sdk-react',
    '@strimz/shared-types',
    '@strimz/shared-config',
  ],
  images: {
    // We use `quality={100}` on a few brand assets (logos, hero vector).
    // Pre-declare both common values so Next 16 stops warning.
    qualities: [75, 100],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
}

export default withMDX(config)
