'use client'

import * as React from 'react'
import { StrimzBrowserClient } from '@strimz/sdk/browser'

export interface StrimzContextValue {
  client: StrimzBrowserClient
  /** Public origin where Strimz hosts its checkout UI. */
  checkoutOrigin: string
}

const StrimzContext = React.createContext<StrimzContextValue | null>(null)

export interface StrimzProviderProps {
  /** Publishable key, e.g. process.env.NEXT_PUBLIC_STRIMZ_PUBLISHABLE_KEY. */
  publishableKey: string
  /** Override the API base URL. */
  apiBaseUrl?: string
  /** Override the hosted-checkout origin (scheme + host, no path). Defaults to https://strimz.finance. */
  checkoutOrigin?: string
  children: React.ReactNode
}

/**
 * Wrap any tree that uses Strimz components or hooks.
 * Builds a memoised `StrimzBrowserClient` and a checkout origin.
 */
export function StrimzProvider({
  publishableKey,
  apiBaseUrl,
  checkoutOrigin = 'https://strimz.finance',
  children,
}: StrimzProviderProps) {
  const value = React.useMemo<StrimzContextValue>(
    () => ({
      client: new StrimzBrowserClient({ publishableKey, baseUrl: apiBaseUrl }),
      checkoutOrigin,
    }),
    [publishableKey, apiBaseUrl, checkoutOrigin],
  )
  return <StrimzContext.Provider value={value}>{children}</StrimzContext.Provider>
}

export function useStrimzContext(): StrimzContextValue {
  const ctx = React.useContext(StrimzContext)
  if (!ctx) {
    throw new Error('useStrimzContext / Strimz components must be used inside a <StrimzProvider/>.')
  }
  return ctx
}
