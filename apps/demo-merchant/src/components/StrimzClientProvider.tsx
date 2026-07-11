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
  const key = process.env.NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY
  if (!key && typeof window !== 'undefined') {
    // Real demo run in the browser with no key — fail loudly instead of
    // silently pointing an unauthenticated client at the API.
    throw new Error(
      'NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY is not set. Paste the pk_live_... printed by the seed script into apps/demo-merchant/.env.',
    )
  }
  // The provider always mounts so `useStrimzContext` never throws. During a
  // production build the static prerender runs server-side with no env; the
  // placeholder is a valid-shaped key that lets the client construct. A real
  // deploy always has the key inlined, and the guard above catches misconfig.
  const publishableKey = key ?? 'pk_test_prerender_placeholder'
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
