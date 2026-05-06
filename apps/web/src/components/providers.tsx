'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider } from '@privy-io/react-auth'
import { StrimzProvider } from '@strimz/sdk-react'
import { env } from '@/lib/env'

/**
 * Root-provider tree. Strimz is light-mode only — `next-themes` and the
 * dark-class plumbing are deliberately absent.
 *
 * Privy is conditionally mounted: when `NEXT_PUBLIC_PRIVY_APP_ID` is
 * absent (e.g., a Playwright run that mocks auth), we render children
 * without it so test pages still mount.
 */
export function Providers({ children }: { children: React.ReactNode }) {
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

  const tree = (
    <QueryClientProvider client={queryClient}>
      <StrimzProvider publishableKey={env.strimzPublishableKey} apiBaseUrl={env.apiUrl}>
        {children}
      </StrimzProvider>
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
      }}
    >
      {tree}
    </PrivyProvider>
  )
}
