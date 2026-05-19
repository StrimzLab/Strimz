'use client'

import { StrimzBrowserClient } from '@strimz/sdk/browser'
import { env } from './env'

/**
 * Lazy-initialised browser Strimz client. Lives in module scope so
 * route components share a single instance (and BrowserClient's
 * internal fetch retry state stays coherent across calls). Reads the
 * publishable key from `NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY`.
 */
let cached: StrimzBrowserClient | undefined

export function strimzBrowserClient(): StrimzBrowserClient {
  if (!cached) {
    cached = new StrimzBrowserClient({
      publishableKey: env.strimzPublishableKey,
      baseUrl: env.apiUrl,
    })
  }
  return cached
}
