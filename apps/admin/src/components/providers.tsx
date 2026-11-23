'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import { getArcChain } from '@strimz/shared-config'
import { useResolvedTheme } from '@strimz/ui'
import { env } from '@strimz/web-shared/lib/env'
import { privyAppearanceTheme } from '@strimz/web-shared/lib/theme'
import { AdminApiClient } from '@strimz/web-shared/lib/admin-api'
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

  if (!env.privyAppId) {
    return (
      <QueryClientProvider client={queryClient}>
        <AdminApiProvider>{children}</AdminApiProvider>
      </QueryClientProvider>
    )
  }

  return (
    <PrivyProvider
      appId={env.privyAppId}
      config={{
        appearance: {
          theme: privyAppearanceTheme(resolvedTheme ?? 'light'),
          accentColor: '#02C76A',
        },
        loginMethods: ['email', 'google'],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: getArcChain(env.arcEnvironment),
        supportedChains: [getArcChain(env.arcEnvironment)],
      }}
    >
      <SessionCacheGuard cache={queryClient} />
      <QueryClientProvider client={queryClient}>
        <PrivyAdminApi>{children}</PrivyAdminApi>
      </QueryClientProvider>
    </PrivyProvider>
  )
}

// Takes the token from this app's own Privy, so the API client can't end up asking a
// second, never-mounted copy of the library.
function PrivyAdminApi({ children }: { children: ReactNode }) {
  const { getAccessToken } = usePrivy()
  const client = useMemo(() => new AdminApiClient({ getAccessToken }), [getAccessToken])
  return <AdminApiProvider client={client}>{children}</AdminApiProvider>
}
