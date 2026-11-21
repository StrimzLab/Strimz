'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider } from '@privy-io/react-auth'
import { StrimzProvider } from '@strimz/sdk-react'
import { getArcChain } from '@strimz/shared-config'
import { useResolvedTheme } from '@strimz/ui'
import { env } from '@strimz/web-shared/lib/env'
import { privyAppearanceTheme } from '@strimz/web-shared/lib/theme'
import { MerchantApiProvider } from '@/hooks/api/merchant-api-context'
import { SessionCacheGuard } from '@strimz/web-shared/components/auth/session-cache-guard'

/**
 * Merchant dashboard providers: Privy, React Query, the merchant API and the
 * Strimz SDK. Mounted in the browser only (see `client-providers.tsx`).
 */
export function Providers({ children }: { children: ReactNode }) {
  const resolvedTheme = useResolvedTheme()
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
        <StrimzProvider publishableKey={env.strimzPublishableKey} apiBaseUrl={env.apiUrl}>
          {children}
        </StrimzProvider>
      </MerchantApiProvider>
    </QueryClientProvider>
  )

  if (!env.privyAppId) return tree

  return (
    <PrivyProvider
      appId={env.privyAppId}
      config={{
        appearance: {
          theme: privyAppearanceTheme(resolvedTheme ?? 'light'),
          accentColor: '#02C76A',
        },
        loginMethods: ['email', 'google', 'passkey'],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: getArcChain(env.arcEnvironment),
        supportedChains: [getArcChain(env.arcEnvironment)],
      }}
    >
      <SessionCacheGuard cache={queryClient} />
      {tree}
    </PrivyProvider>
  )
}
