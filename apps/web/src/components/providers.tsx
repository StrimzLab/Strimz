'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider } from '@privy-io/react-auth'
import { StrimzProvider } from '@strimz/sdk-react'
import { WagmiProvider, cookieToInitialState, type Config } from 'wagmi'
import { createAppKit } from '@reown/appkit/react'
import { arcMainnet, arcTestnet, getArcChain } from '@strimz/shared-config'
import { appkitMetadata, defaultNetwork, networks, projectId, wagmiAdapter } from '@/lib/wagmi'
import { env } from '@/lib/env'

/**
 * Root-provider tree. Strimz is light-mode only — `next-themes` and the
 * dark-class plumbing are deliberately absent.
 *
 * Provider stacks (outer → inner):
 *
 *   <PrivyProvider>           merchant auth (email + embedded wallet)
 *     <WagmiProvider>         payer wallets (external, via Reown AppKit)
 *       <QueryClientProvider> server state for both worlds
 *         <StrimzProvider>    Strimz SDK (api client + publishable key)
 *           {children}
 *
 * Privy and Wagmi are independent — they don't share connector state.
 * Privy handles `/signup`, `/login`, `/app/*`. Wagmi/AppKit handles the
 * public `/pay/[sessionId]` and `/sub/[planId]` checkout flows.
 *
 * Both providers are conditional on their env var being set so the
 * marketing site renders cleanly in environments where neither is
 * configured (e.g. Playwright runs that mock auth).
 */

// Initialize AppKit once, at module load. Required by Reown's design —
// `createAppKit` registers the connect-modal web component globally.
// Skipped when projectId is missing so we don't pollute the global
// namespace with a half-configured modal.
if (projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks,
    defaultNetwork,
    metadata: appkitMetadata,
    themeMode: 'light',
    themeVariables: {
      '--w3m-accent': '#02C76A',
      '--w3m-color-mix': '#02C76A',
      '--w3m-color-mix-strength': 25,
      '--w3m-border-radius-master': '2px',
    },
    features: {
      // Privy already handles email + social login for merchants. We
      // don't want AppKit to also offer them on the payer-facing
      // checkout — keeps the modal focused on actual external wallets.
      analytics: true,
      email: false,
      socials: [],
    },
  })
}

export function Providers({
  children,
  cookies,
}: {
  children: ReactNode
  /**
   * The `Cookie` header from the incoming request, forwarded from the
   * root layout. Used by Reown's WagmiAdapter to hydrate connector
   * state on the server so the initial paint shows the correct wallet
   * connection rather than flashing from "disconnected" to "connected".
   * `null` when called from a client-only context (rare).
   */
  cookies: string | null
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  // Wagmi + Query + Strimz SDK form the inner tree.
  let tree: ReactNode = (
    <QueryClientProvider client={queryClient}>
      <StrimzProvider publishableKey={env.strimzPublishableKey} apiBaseUrl={env.apiUrl}>
        {children}
      </StrimzProvider>
    </QueryClientProvider>
  )

  // Wrap with Wagmi only when Reown is configured. The adapter exists
  // either way (its module-level construction is stable), but mounting
  // the provider with a placeholder projectId would surface "invalid
  // project" errors in the modal at runtime.
  if (projectId) {
    const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)
    tree = (
      <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
        {tree}
      </WagmiProvider>
    )
  }

  // Privy is the outermost. When unset, render the inner tree directly
  // so marketing pages still mount in environments with no auth backend.
  if (!env.privyAppId) return tree

  return (
    <PrivyProvider
      appId={env.privyAppId}
      config={{
        appearance: { theme: 'light', accentColor: '#02C76A' },
        loginMethods: ['email', 'wallet', 'google'],
        embeddedWallets: { createOnLogin: 'users-without-wallets' },
        // Tell Privy to operate on Arc by default so embedded wallets
        // are created with the right chain id rather than Ethereum
        // mainnet (Privy's default).
        defaultChain: getArcChain(env.arcEnvironment),
        supportedChains: [arcTestnet, arcMainnet],
      }}
    >
      {tree}
    </PrivyProvider>
  )
}
