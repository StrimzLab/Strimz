'use client'

import { useEffect, type ReactNode } from 'react'
import { WagmiProvider, cookieToInitialState, type Config } from 'wagmi'
import { createAppKit } from '@reown/appkit/react'
import { useResolvedTheme } from '@strimz/ui'

import { appkitMetadata, defaultNetwork, networks, projectId, wagmiAdapter } from '@/lib/wagmi'
import { reownThemeMode } from '@/lib/theme'

// Module-load side effect: registers the Reown connect-modal web
// component globally. Scoped to this file so it only runs when the
// checkout route group is entered, never on marketing / dashboard.
const appKit = projectId
  ? createAppKit({
      adapters: [wagmiAdapter],
      projectId,
      networks,
      defaultNetwork,
      metadata: appkitMetadata,
      themeVariables: {
        '--w3m-accent': '#02C76A',
        '--w3m-color-mix': '#02C76A',
        '--w3m-color-mix-strength': 5,
        '--w3m-border-radius-master': '2px',
      },
      features: {
        analytics: true,
        email: false,
        socials: [],
      },
    })
  : null

type AppKitInstance = NonNullable<typeof appKit>

function AppKitThemeSync({ instance }: { instance: AppKitInstance }) {
  const resolved = useResolvedTheme()
  useEffect(() => {
    if (resolved) instance.setThemeMode(reownThemeMode(resolved))
  }, [instance, resolved])
  return null
}

export function CheckoutProviders({ children }: { children: ReactNode }) {
  if (!appKit) return <>{children}</>

  // Cookies deliberately not threaded here. Hosted checkouts are
  // one-shot ceremonies: the wallet picker must run every time so a
  // payer picking a different wallet this session is not silently
  // routed to yesterday's connector.
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, null)
  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
      reconnectOnMount={false}
    >
      <AppKitThemeSync instance={appKit} />
      {children}
    </WagmiProvider>
  )
}
