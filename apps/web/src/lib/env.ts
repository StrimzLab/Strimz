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
  // On-chain contract addresses the checkout reads. These appear in
  // the typed-data payload the payer signs, so they're public.
  paymentsAddress: (process.env.NEXT_PUBLIC_STRIMZ_PAYMENTS_ADDRESS ?? '') as `0x${string}` | '',
  subscriptionsAddress: (process.env.NEXT_PUBLIC_STRIMZ_SUBSCRIPTIONS_ADDRESS ?? '') as
    | `0x${string}`
    | '',
  // Default USDC for the v1 demo flows. Sessions in the wild may bind
  // a different token; the checkout reads the canonical address from
  // the session payload first, falls back to this for demo seeds.
  usdcAddress: (process.env.NEXT_PUBLIC_STRIMZ_USDC_ADDRESS ?? '') as `0x${string}` | '',
} as const
