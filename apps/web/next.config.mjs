import { ARC_CHAINS } from '@strimz/shared-config/chains'
import { createMDX } from 'fumadocs-mdx/next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const withMDX = createMDX()

const BASELINE_SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const CSP_REPORT_PATH = '/api/csp-report'
const CSP_REPORT_GROUP = 'csp-endpoint'

const PRIVY_ORIGIN = 'https://auth.privy.io'
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com'

const WALLETCONNECT_FRAME_ORIGINS = [
  'https://verify.walletconnect.com',
  'https://verify.walletconnect.org',
  'https://secure.walletconnect.com',
  'https://secure.walletconnect.org',
]

const WALLETCONNECT_CONNECT_ORIGINS = [
  'https://rpc.walletconnect.com',
  'https://rpc.walletconnect.org',
  'https://relay.walletconnect.com',
  'https://relay.walletconnect.org',
  'wss://relay.walletconnect.com',
  'wss://relay.walletconnect.org',
  'https://pulse.walletconnect.com',
  'https://pulse.walletconnect.org',
  'https://api.web3modal.com',
  'https://api.web3modal.org',
  'https://keys.walletconnect.com',
  'https://keys.walletconnect.org',
  'https://notify.walletconnect.com',
  'https://notify.walletconnect.org',
  'https://echo.walletconnect.com',
  'https://echo.walletconnect.org',
  'https://push.walletconnect.com',
  'https://push.walletconnect.org',
  'https://explorer-api.walletconnect.com',
  'wss://www.walletlink.org',
  'https://cca-lite.coinbase.com',
]

const PRIVY_CONNECT_ORIGINS = [PRIVY_ORIGIN, 'https://*.rpc.privy.systems']

const UPLOADTHING_CONNECT_ORIGINS = ['https://*.ingest.uploadthing.com']

const CHECKOUT_SOURCE = '/:segment(pay|sub)/:path*'
const NON_CHECKOUT_SOURCE = '/((?!pay(?:/|$)|sub(?:/|$)).*)'

function originOf(name) {
  const raw = process.env[name]
  if (!raw) return []
  return [new URL(raw).origin]
}

function arcRpcOrigins() {
  return Object.values(ARC_CHAINS).flatMap((chain) =>
    chain.rpcUrls.default.http.map((url) => new URL(url).origin),
  )
}

function unique(sources) {
  return [...new Set(sources)]
}

function contentSecurityPolicy(frameAncestors) {
  const directives = [
    ['default-src', ["'self'"]],
    ['script-src', ["'self'", "'unsafe-inline'", PRIVY_ORIGIN, TURNSTILE_ORIGIN]],
    ['style-src', ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']],
    ['img-src', ["'self'", 'data:', 'blob:', 'https:']],
    ['font-src', ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://fonts.reown.com']],
    [
      'connect-src',
      unique([
        "'self'",
        ...originOf('NEXT_PUBLIC_API_URL'),
        ...arcRpcOrigins(),
        ...originOf('NEXT_PUBLIC_ARC_RPC_URL'),
        ...PRIVY_CONNECT_ORIGINS,
        ...WALLETCONNECT_CONNECT_ORIGINS,
        ...UPLOADTHING_CONNECT_ORIGINS,
      ]),
    ],
    ['frame-src', [PRIVY_ORIGIN, ...WALLETCONNECT_FRAME_ORIGINS, TURNSTILE_ORIGIN]],
    ['child-src', [PRIVY_ORIGIN, ...WALLETCONNECT_FRAME_ORIGINS, TURNSTILE_ORIGIN]],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', [frameAncestors]],
    ['report-uri', [CSP_REPORT_PATH]],
    ['report-to', [CSP_REPORT_GROUP]],
  ]
  return directives.map(([name, sources]) => `${name} ${sources.join(' ')}`).join('; ')
}

function cspReportOnly(frameAncestors) {
  return {
    key: 'Content-Security-Policy-Report-Only',
    value: contentSecurityPolicy(frameAncestors),
  }
}

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
      // MetaMask SDK conditionally imports @react-native-async-storage
      // for RN environments. In a Next.js web bundle it will never run,
      // but webpack still tries to resolve the module and errors out.
      // Aliasing to `false` tells webpack "this module doesn't exist for
      // this target" — MetaMask SDK's runtime guard skips it cleanly.
      // See wagmi issue #3928 + MetaMask SDK docs.
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
  },
  headers() {
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [
          ...BASELINE_SECURITY_HEADERS,
          { key: 'Reporting-Endpoints', value: `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"` },
        ],
      },
      {
        source: NON_CHECKOUT_SOURCE,
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }, cspReportOnly("'none'")],
      },
      { source: CHECKOUT_SOURCE, headers: [cspReportOnly('*')] },
    ])
  },
}

export default withMDX(config)
