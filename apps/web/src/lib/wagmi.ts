/**
 * Reown AppKit + wagmi setup for the public checkout pages.
 *
 * Two wallet ecosystems coexist in this app:
 *
 *   - **Privy**. Merchant identity. Email/Google/wallet login on
 *     `/signup` and `/login`, embedded wallets for the dashboard owner.
 *     See `components/providers.tsx`.
 *
 *   - **Reown AppKit (this file)**. Payer wallet connect on the public
 *     `/pay/[sessionId]` and `/sub/[planId]` checkout pages. Anonymous
 *     payers connect any WalletConnect-compatible wallet (MetaMask,
 *     Rainbow, Coinbase Wallet, etc.) to sign the on-chain payment.
 *
 * The two domains never share state. They live on different routes and
 * serve different actors (the merchant operates on the dashboard, the
 * payer arrives at the hosted checkout).
 *
 * Server-safe: no `window` references at module level. The actual
 * `createAppKit()` call lives in `components/providers.tsx` so it only
 * runs in the client bundle.
 */

import { cookieStorage, createStorage } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { arcTestnet } from '@strimz/shared-config'
import { env } from './env'

export const projectId = env.reownProjectId

/**
 * Arc testnet is the only supported network today. Add `arcMainnet`
 * back to `networks` and switch `defaultNetwork` on it once Arc mainnet
 * launches.
 */
export const networks = [arcTestnet] as unknown as [AppKitNetwork, ...AppKitNetwork[]]

/** Active network. Testnet-only until Arc mainnet ships. */
export const defaultNetwork = arcTestnet as unknown as AppKitNetwork

/**
 * The wagmi adapter is always constructed (so imports are stable) but
 * is only *used* when `projectId` is set. When unset, the Providers
 * component skips mounting WagmiProvider and the adapter sits idle.
 */
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId: projectId || 'placeholder-strimz-no-reown-configured',
  networks,
})

/**
 * Metadata shown to wallets during connect. The `url` must match the
 * deployment's actual origin for WalletConnect's Verify API to confirm.
 * Preview deploys will show as "unverified" because `appUrl` points at
 * the prod domain; that's fine for previews.
 */
export const appkitMetadata = {
  name: 'Strimz',
  description: 'B2B subscription billing on stablecoins. Settled in USDC on Arc.',
  url: env.appUrl,
  icons: [`${env.appUrl}/favicon-512x512.png`],
}
