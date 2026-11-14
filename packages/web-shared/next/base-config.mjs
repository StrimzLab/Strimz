import { fileURLToPath } from 'node:url'
import { securityHeaders } from './security-headers.mjs'

const BROWSER_ONLY_STUB = fileURLToPath(new URL('./browser-only-stub.cjs', import.meta.url))

const TRANSPILE = [
  '@strimz/ui',
  '@strimz/sdk',
  '@strimz/sdk-react',
  '@strimz/shared-types',
  '@strimz/shared-config',
]

/**
 * Settings every Strimz web app shares. `aliases` adds webpack aliases on top
 * of the wallet-SDK ones (docs uses it for Fumadocs' `.source`).
 *
 * `browserOnly` packages are swapped for a stub in the server build. Use it only
 * for SDKs whose whole provider tree is loaded with `ssr: false`; it keeps them
 * out of the Worker, which has a 3 MiB limit on Workers Free.
 */
export function baseNextConfig({ frameAncestors, aliases = {}, browserOnly = [] } = {}) {
  return {
    reactStrictMode: true,
    poweredByHeader: false,
    typedRoutes: false,
    transpilePackages: TRANSPILE,
    // Workers Free has no Images binding, so files are served as they are.
    images: { unoptimized: true, qualities: [75, 100] },
    webpack: (cfg, { isServer }) => {
      cfg.resolve = cfg.resolve ?? {}
      cfg.resolve.alias = {
        ...(cfg.resolve.alias ?? {}),
        ...aliases,
        ...(isServer
          ? Object.fromEntries(browserOnly.map((pkg) => [`${pkg}$`, BROWSER_ONLY_STUB]))
          : {}),
        // MetaMask SDK imports this only for React Native; it never runs on the web.
        '@react-native-async-storage/async-storage': false,
      }
      // Node-only optional deps of Reown's wagmi adapter (Reown's Next.js guide).
      cfg.externals = cfg.externals ?? []
      cfg.externals.push('pino-pretty', 'lokijs', 'encoding')
      return cfg
    },
    headers() {
      return Promise.resolve(securityHeaders({ frameAncestors }))
    },
  }
}
