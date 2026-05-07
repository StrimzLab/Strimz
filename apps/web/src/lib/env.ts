/**
 * Public client environment. Anything `NEXT_PUBLIC_` is inlined into
 * the browser bundle at build time, so values are not secrets — never
 * put a private key here.
 */
export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  strimzPublishableKey: process.env.NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY ?? 'pk_test_placeholder',
  privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '',
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '',
  reownProjectId: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? '',
  arcEnvironment: (process.env.NEXT_PUBLIC_ARC_ENVIRONMENT ?? 'testnet') as 'testnet' | 'mainnet',
  arcRpcUrl: process.env.NEXT_PUBLIC_ARC_RPC_URL ?? '',
} as const
