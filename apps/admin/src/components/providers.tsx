'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import { getArcChain } from '@strimz/shared-config'
import { useResolvedTheme } from '@strimz/ui'
import { env } from '@strimz/web-shared/lib/env'
import { privyAppearanceTheme } from '@strimz/web-shared/lib/theme'
import { networks } from '@strimz/web-shared/lib/networks'
import {
  DashboardModeProvider,
  useDashboardMode,
  useNetwork,
} from '@strimz/web-shared/lib/dashboard-mode'
import { AdminApiClient } from '@strimz/web-shared/lib/admin-api'
import { AdminApiProvider } from '@strimz/web-shared/hooks/admin/admin-context'
import { SessionCacheGuard } from '@strimz/web-shared/components/auth/session-cache-guard'

const newQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })

/** Live first, so Privy's default chain is mainnet when the build has it. */
const chains = [...networks].reverse().map((n) => getArcChain(n.arcEnvironment))

/** Admin providers: Privy, the Test / Live mode, React Query and the admin API. Browser only. */
export function Providers({ children }: { children: ReactNode }) {
  const resolvedTheme = useResolvedTheme()
  const privy = Boolean(env.privyAppId)
  const tree = (
    <DashboardModeProvider>
      <ModeScope privy={privy}>{children}</ModeScope>
    </DashboardModeProvider>
  )

  if (!privy) return tree

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
        defaultChain: chains[0],
        supportedChains: chains,
      }}
    >
      {tree}
    </PrivyProvider>
  )
}

/** Remounts per mode, so test and live never share cached data or in-flight requests. */
function ModeScope({ privy, children }: { privy: boolean; children: ReactNode }) {
  const mode = useDashboardMode()
  return (
    <ModeTree key={mode} privy={privy}>
      {children}
    </ModeTree>
  )
}

function ModeTree({ privy, children }: { privy: boolean; children: ReactNode }) {
  const [queryClient] = useState(newQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      {privy ? (
        <>
          <SessionCacheGuard cache={queryClient} />
          <PrivyAdminApi>{children}</PrivyAdminApi>
        </>
      ) : (
        <NetworkAdminApi>{children}</NetworkAdminApi>
      )}
    </QueryClientProvider>
  )
}

// Takes the token from this app's own Privy, so the API client can't end up asking a
// second, never-mounted copy of the library.
function PrivyAdminApi({ children }: { children: ReactNode }) {
  const { getAccessToken } = usePrivy()
  const network = useNetwork()
  const client = useMemo(
    () => new AdminApiClient({ getAccessToken, network }),
    [getAccessToken, network],
  )
  return <AdminApiProvider client={client}>{children}</AdminApiProvider>
}

function NetworkAdminApi({ children }: { children: ReactNode }) {
  const network = useNetwork()
  const client = useMemo(() => new AdminApiClient({ network }), [network])
  return <AdminApiProvider client={client}>{children}</AdminApiProvider>
}
