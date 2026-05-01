'use client'

import { useState } from 'react'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider } from '@privy-io/react-auth'
import { StrimzProvider } from '@strimz/sdk-react'
import { env } from '@/lib/env'

/**
 * Single root-provider tree. Order matters:
 *   ThemeProvider must wrap everything so the `class` attribute is set
 *   before any child reads `prefers-color-scheme`.
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
      <StrimzProvider config={{ baseUrl: env.apiUrl }}>
        {children}
      </StrimzProvider>
    </QueryClientProvider>
  )

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
    >
      {env.privyAppId ? (
        <PrivyProvider
          appId={env.privyAppId}
          config={{
            appearance: { theme: 'dark', accentColor: '#02C76A' },
            loginMethods: ['email', 'wallet', 'google'],
            embeddedWallets: { createOnLogin: 'users-without-wallets' },
          }}
        >
          {tree}
        </PrivyProvider>
      ) : (
        tree
      )}
    </ThemeProvider>
  )
}
