'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { MerchantApi } from '@/lib/merchant-api'

/**
 * React context that holds the merchant API aggregator.
 *
 * Why context (rather than module-level singleton):
 *   - Tests + Storybook can mount the dashboard with a stub `MerchantApi`
 *     that has a fake token provider, without monkey-patching imports.
 *   - When the app moves to multi-tenant subdomains (parent merchants
 *     vs sub-merchants), the per-subtree base URL can be swapped via a
 *     nested provider — no code change at the call site.
 *
 * Why memoised:
 *   - The default constructor takes no expensive arguments, but the
 *     `MerchantApi` instance holds references to the typed resource
 *     bindings. Recreating it on every parent render would invalidate
 *     dependency identity for `useEffect` chains downstream. `useMemo`
 *     pins it to the lifetime of the provider.
 */
const MerchantApiContext = createContext<MerchantApi | null>(null)

export function MerchantApiProvider({
  children,
  client,
}: {
  children: ReactNode
  /**
   * Optional pre-constructed client (tests pass a stub here). Production
   * code mounts this with no `client` and gets the default instance.
   */
  client?: MerchantApi
}) {
  const value = useMemo(() => client ?? new MerchantApi(), [client])
  return <MerchantApiContext.Provider value={value}>{children}</MerchantApiContext.Provider>
}

/**
 * Returns the merchant API for the current tree. Throws if used outside
 * a provider — a clearer signal than the silent `null` you'd otherwise
 * see at the first method call.
 */
export function useMerchantApi(): MerchantApi {
  const api = useContext(MerchantApiContext)
  if (!api) {
    throw new Error(
      '`useMerchantApi` must be called from inside <MerchantApiProvider/>. Mount one near the dashboard layout.',
    )
  }
  return api
}
