'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider } from '@privy-io/react-auth'
import { getArcChain } from '@strimz/shared-config'
import { useResolvedTheme } from '@strimz/ui'
import { env } from '@strimz/web-shared/lib/env'
import { privyAppearanceTheme } from '@strimz/web-shared/lib/theme'
import { AdminApiProvider } from '@strimz/web-shared/hooks/admin/admin-context'
import { SessionCacheGuard } from '@strimz/web-shared/components/auth/session-cache-guard'

/** Admin providers: Privy, React Query and the admin API. Browser only. */
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
      <AdminApiProvider>{children}</AdminApiProvider>
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
        loginMethods: ['email', 'wallet', 'google'],
        embeddedWallets: { createOnLogin: 'users-without-wallets' },
        defaultChain: getArcChain(env.arcEnvironment),
        supportedChains: [getArcChain(env.arcEnvironment)],
      }}
    >
      <SessionCacheGuard cache={queryClient} />
      {tree}
    </PrivyProvider>
  )
}
