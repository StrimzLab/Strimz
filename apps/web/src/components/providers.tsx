'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider } from '@privy-io/react-auth'
import { StrimzProvider } from '@strimz/sdk-react'
import { arcTestnet } from '@strimz/shared-config'
import { env } from '@/lib/env'
import { MerchantApiProvider } from '@/hooks/api/merchant-api-context'
import { AdminApiProvider } from '@/hooks/admin/admin-context'

/**
 * Root-provider tree. Strimz is light-mode only.
 *
 *   <PrivyProvider>           merchant auth (email + embedded wallet)
 *     <QueryClientProvider>   server state
 *       <StrimzProvider>      Strimz SDK (api client + publishable key)
 *         {children}
 *
 * Reown / Wagmi is NOT mounted here. It only wraps the checkout route
 * group (see `apps/web/src/app/(checkout)/layout.tsx` and
 * `components/checkout-providers.tsx`) so the marketing site never
 * initialises AppKit and never pops the switch-network modal.
 */
export function Providers({ children }: { children: ReactNode }) {
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

  const tree: ReactNode = (
    <QueryClientProvider client={queryClient}>
      <MerchantApiProvider>
        <AdminApiProvider>
          <StrimzProvider publishableKey={env.strimzPublishableKey} apiBaseUrl={env.apiUrl}>
            {children}
          </StrimzProvider>
        </AdminApiProvider>
      </MerchantApiProvider>
    </QueryClientProvider>
  )

  if (!env.privyAppId) return tree

  return (
    <PrivyProvider
      appId={env.privyAppId}
      config={{
        appearance: { theme: 'light', accentColor: '#02C76A' },
        loginMethods: ['email', 'wallet', 'google'],
        embeddedWallets: { createOnLogin: 'users-without-wallets' },
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
      }}
    >
      {tree}
    </PrivyProvider>
  )
}
