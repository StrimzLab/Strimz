'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { safeNextPath, withNext } from '@strimz/web-shared/lib/auth-redirect'

import { AuthCard } from '@/components/auth/auth-card'
import { PasskeyOffer } from '@/components/auth/passkey-offer'
import { notePasskeyOffer, passkeysOf } from '@/lib/passkeys'

export default function PasskeyPage() {
  return (
    <Suspense>
      <Passkey />
    </Suspense>
  )
}

function Passkey() {
  const router = useRouter()
  const next = safeNextPath(useSearchParams().get('next')) ?? '/app'

  const { ready, authenticated, user } = usePrivy()
  const hasPasskey = passkeysOf(user?.linkedAccounts ?? []).length > 0

  useEffect(() => {
    if (!ready) return
    if (!authenticated) router.replace(withNext('/login', next))
    else if (hasPasskey) router.replace(next)
    else notePasskeyOffer()
  }, [ready, authenticated, hasPasskey, next, router])

  return (
    <AuthCard title="Sign in faster next time" description="Add a passkey to your Strimz account.">
      {ready && authenticated && <PasskeyOffer onDone={() => router.replace(next)} />}
    </AuthCard>
  )
}
