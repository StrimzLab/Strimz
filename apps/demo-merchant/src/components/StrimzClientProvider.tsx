'use client'

import { StrimzProvider } from '@strimz/sdk-react'
import type { ReactNode } from 'react'

/**
 * Wraps the app in Strimz's React context so `<StrimzPayButton>` +
 * `useStrimzCheckout()` know where to open the hosted checkout. We
 * point `checkoutOrigin` at the payment-session path segment because
 * the SDK builds URLs as `${checkoutOrigin}/${sessionId}` — the actual
 * hosted checkout for one-shot payments lives at /pay/{sessionId}.
 */

interface Props {
  children: ReactNode
}

export function StrimzClientProvider({ children }: Props) {
  const origin = process.env.NEXT_PUBLIC_STRIMZ_CHECKOUT_ORIGIN ?? 'http://localhost:3000'
  const publishableKey = process.env.NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY
  if (!publishableKey) {
    // Fail loudly during the demo boot instead of silently sending an
    // unauthenticated browser client at the API.
    throw new Error(
      'NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY is not set. Paste the pk_live_... printed by the seed script into apps/demo-merchant/.env.',
    )
  }
  return (
    <StrimzProvider
      publishableKey={publishableKey}
      apiBaseUrl={process.env.STRIMZ_API_URL || 'http://localhost:4000'}
      checkoutOrigin={`${origin}/pay`}
    >
      {children}
    </StrimzProvider>
  )
}
