'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// Privy and the wallet SDKs only run in the browser, so they stay out of the Worker.
export const ClientProviders = dynamic(() => import('./providers').then((m) => m.Providers), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="text-muted-foreground size-6 animate-spin" aria-label="Loading" />
    </div>
  ),
})
