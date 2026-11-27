'use client'

import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { primaryNetwork } from '@strimz/web-shared/lib/networks'
import { MerchantApiProvider } from '@/hooks/api/merchant-api-context'
import { primaryQueryClient } from '@/lib/query-clients'

/** Sign-in, onboarding and terms always act on the live account, whichever mode is selected. */
export function PrimaryNetworkScope({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={primaryQueryClient}>
      <MerchantApiProvider baseUrl={primaryNetwork.apiUrl}>{children}</MerchantApiProvider>
    </QueryClientProvider>
  )
}
