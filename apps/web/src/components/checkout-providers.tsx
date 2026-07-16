'use client'

import type { ReactNode } from 'react'
import { WagmiProvider, cookieToInitialState, type Config } from 'wagmi'
import { createAppKit } from '@reown/appkit/react'

import { appkitMetadata, defaultNetwork, networks, projectId, wagmiAdapter } from '@/lib/wagmi'

// Module-load side effect: registers the Reown connect-modal web
// component globally. Scoped to this file so it only runs when the
// checkout route group is entered, never on marketing / dashboard.
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
      '--w3m-color-mix-strength': 5,
      '--w3m-border-radius-master': '2px',
    },
    features: {
      analytics: true,
      email: false,
      socials: [],
    },
  })
}

export function CheckoutProviders({ children }: { children: ReactNode }) {
  if (!projectId) return <>{children}</>

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
      {children}
    </WagmiProvider>
  )
}
