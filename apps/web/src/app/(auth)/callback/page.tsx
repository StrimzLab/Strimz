'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy, getAccessToken } from '@privy-io/react-auth'
import { Loader2 } from 'lucide-react'
import { AuthCard } from '@/components/auth/auth-card'
import { env } from '@/lib/env'

export default function AuthCallbackPage() {
  const router = useRouter()
  const privy = usePrivyOrNull()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!privy) return
    if (privy.ready === false) return
    if (!privy.authenticated) {
      router.replace('/login')
      return
    }
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
      const body = (await r.json()) as { isNewMerchant: boolean }
      router.replace(body.isNewMerchant ? '/app/onboarding' : '/app')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <AuthCard
      title="Signing you in"
      description={error ?? 'Hold on a moment.'}
    >
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
