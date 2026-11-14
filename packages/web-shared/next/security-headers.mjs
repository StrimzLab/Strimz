import { ARC_CHAINS } from '@strimz/shared-config/chains'

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

// `frameAncestors` is `'none'` for every app except checkout, which is embedded.
export function securityHeaders({ frameAncestors = "'none'" } = {}) {
  const headers = [
    ...BASELINE_SECURITY_HEADERS,
    { key: 'Reporting-Endpoints', value: `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"` },
    cspReportOnly(frameAncestors),
  ]
  if (frameAncestors === "'none'") headers.push({ key: 'X-Frame-Options', value: 'DENY' })
  return [{ source: '/:path*', headers }]
}
