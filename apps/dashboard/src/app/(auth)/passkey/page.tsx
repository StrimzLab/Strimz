'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { safeNextPath, withNext } from '@strimz/web-shared/lib/auth-redirect'

import { AuthCard } from '@/components/auth/auth-card'
import { PasskeyOffer } from '@/components/auth/passkey-offer'
import { hasPasskeyMfa } from '@/hooks/use-passkey-mfa'
import { passkeysOf } from '@/lib/passkeys'

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

  const { ready, authenticated, user, logout } = usePrivy()
  const enrolled = hasPasskeyMfa(user)
  const linked = passkeysOf(user?.linkedAccounts ?? []).length > 0

  useEffect(() => {
    if (!ready) return
    if (!authenticated) router.replace(withNext('/login', next))
    else if (enrolled) router.replace(next)
  }, [ready, authenticated, enrolled, next, router])

  return (
    <AuthCard
      title="Add a passkey"
      description="The last step. Your passkey signs you in and confirms withdrawals and payout changes."
    >
      {ready && authenticated && user && !enrolled && (
        <PasskeyOffer
          user={user}
          linked={linked}
          onDone={() => router.replace(next)}
          onSignOut={() => {
            void logout().then(() => router.replace('/login'))
          }}
        />
      )}
    </AuthCard>
  )
}
