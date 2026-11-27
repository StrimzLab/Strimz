'use client'

import { useState, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider } from '@privy-io/react-auth'
import { StrimzProvider } from '@strimz/sdk-react'
import { getArcChain } from '@strimz/shared-config'
import { useResolvedTheme } from '@strimz/ui'
import { env } from '@strimz/web-shared/lib/env'
import { privyAppearanceTheme } from '@strimz/web-shared/lib/theme'
import { networks, primaryNetwork } from '@strimz/web-shared/lib/networks'
import {
  DashboardModeProvider,
  useDashboardMode,
  useNetwork,
} from '@strimz/web-shared/lib/dashboard-mode'
import { MerchantApiProvider } from '@/hooks/api/merchant-api-context'
import { SessionCacheGuard } from '@strimz/web-shared/components/auth/session-cache-guard'
import { createQueryClient, primaryQueryClient } from '@/lib/query-clients'

/** Live first, so Privy's default chain is mainnet when the build has it. */
const chains = [...networks].reverse().map((n) => getArcChain(n.arcEnvironment))

/**
 * Merchant dashboard providers: Privy, the Test / Live mode, React Query, the merchant API and
 * the Strimz SDK. Mounted in the browser only (see `client-providers.tsx`).
 */
export function Providers({ children }: { children: ReactNode }) {
  const resolvedTheme = useResolvedTheme()
  const tree = (
    <DashboardModeProvider>
      <ModeScope privy={Boolean(env.privyAppId)}>{children}</ModeScope>
    </DashboardModeProvider>
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
        // PasskeyMfaPrompt is the only MFA screen; Privy's own would race it for the challenge.
        mfa: { noPromptOnMfaRequired: true },
        defaultChain: chains[0],
        supportedChains: chains,
      }}
    >
      <SessionCacheGuard cache={primaryQueryClient} />
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
  const network = useNetwork()
  const isPrimary = network.mode === primaryNetwork.mode
  const [queryClient] = useState(() => (isPrimary ? primaryQueryClient : createQueryClient()))
  const content = network.publishableKey ? (
    <StrimzProvider publishableKey={network.publishableKey} apiBaseUrl={network.apiUrl}>
      {children}
    </StrimzProvider>
  ) : (
    children
  )
  return (
    <QueryClientProvider client={queryClient}>
      {privy && !isPrimary && <SessionCacheGuard cache={queryClient} />}
      <MerchantApiProvider baseUrl={network.apiUrl}>{content}</MerchantApiProvider>
    </QueryClientProvider>
  )
}
