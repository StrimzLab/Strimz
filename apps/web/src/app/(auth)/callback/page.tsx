'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy, getAccessToken } from '@privy-io/react-auth'
import { Loader2 } from 'lucide-react'
import type { Merchant } from '@strimz/shared-types'
import { AuthCard } from '@/components/auth/auth-card'
import { env } from '@/lib/env'

export default function AuthCallbackPage() {
  const router = useRouter()
  const privy = usePrivyOrNull()
  const [error, setError] = useState<string | null>(null)
  // React StrictMode double-invokes effects in dev; without this guard
  // two `/auth/sync` requests race and the second one hits the P2002
  // unique-constraint on `privyUserId`. The backend now handles the
  // race gracefully. But there's no point paying an extra round-trip
  // to Privy + Postgres on every login.
  const syncingRef = useRef(false)

  useEffect(() => {
    if (!privy) return
    if (privy.ready === false) return
    if (!privy.authenticated) {
      router.replace('/login')
      return
    }
    if (syncingRef.current) return
    syncingRef.current = true
    void doSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privy?.ready, privy?.authenticated])

  async function doSync() {
    try {
      const accessToken = await getAccessToken()
      if (!accessToken) return setError('No access token from Privy')
      const r = await fetch(`${env.apiUrl}/v1/auth/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      })
      if (!r.ok) return setError(`Sync failed (${r.status})`)
      const body = (await r.json()) as { merchant: Merchant; isNewMerchant: boolean }
      // Always route by the durable flag on the row. `isNewMerchant`
      // is only true the very first time; a merchant who abandoned
      // onboarding on a prior visit would otherwise slip into /app.
      router.replace(body.merchant.onboardingCompleted ? '/app' : '/onboarding')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <AuthCard title="Signing you in" description={error ?? 'Hold on a moment.'}>
      <div className="flex justify-center py-4">
        {error ? (
          <p className="font-poppins text-sm text-rose-600">{error}</p>
        ) : (
          <Loader2 className="size-6 animate-spin text-[#02C76A]" />
        )}
      </div>
    </AuthCard>
  )
}

function usePrivyOrNull() {
  try {
    return usePrivy()
  } catch {
    return null
  }
}
