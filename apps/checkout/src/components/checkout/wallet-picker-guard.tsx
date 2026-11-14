'use client'

import { useEffect, useRef } from 'react'
import { useAccount, useDisconnect } from 'wagmi'

/**
 * Public hosted checkout pages must not inherit any wallet state from
 * elsewhere in the app. If a payer already connected a wallet on the
 * merchant dashboard (or on a prior checkout visit), landing on
 * `/pay/[sessionId]` or `/sub/[planId]` should show them the wallet
 * picker. Not silently reuse the previous connector for a
 * `signTypedData` call they never authorised for this session.
 *
 * Two safeguards work together:
 *
 *   1. **Server layer** (`apps/web/src/app/layout.tsx`). For
 *      `/pay/*` and `/sub/*` requests, the root layout withholds the
 *      wagmi cookie from `<Providers>`. wagmi starts with no
 *      hydrated state, and the first paint shows "Connect wallet".
 *
 *   2. **Client layer (this component)**. If the payer arrives via
 *      client-side navigation from the dashboard, there is no SSR
 *      round-trip and the wagmi in-memory connector is still hot.
 *      On mount we call `disconnect()` exactly once, forcing them
 *      through the picker for this transaction.
 *
 * Mount this at the top of every checkout page ,  `/pay/[sessionId]`,
 * `/sub/[planId]`, and any future public payer route.
 */
export function WalletPickerGuard() {
  const { isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const guardedRef = useRef(false)

  useEffect(() => {
    // Fire exactly once per mount. React StrictMode double-invokes
    // effects in dev; the ref guard keeps us from calling disconnect
    // twice and racing wagmi's internal state.
    if (guardedRef.current) return
    guardedRef.current = true
    if (isConnected) disconnect()
  }, [isConnected, disconnect])

  return null
}
