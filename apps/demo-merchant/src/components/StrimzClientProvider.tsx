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
    // Fail loudly in the browser, where the demo actually runs and needs
    // the key. During a production build the static prerender runs on the
    // server with no env set — don't crash it there, or CI can't build.
    if (typeof window !== 'undefined') {
      throw new Error(
        'NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY is not set. Paste the pk_live_... printed by the seed script into apps/demo-merchant/.env.',
      )
    }
    return <>{children}</>
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
