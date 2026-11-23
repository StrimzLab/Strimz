'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCreateWallet, usePrivy } from '@privy-io/react-auth'
import { Loader2 } from 'lucide-react'
import type { Merchant } from '@strimz/shared-types'
import { TurnstileWidget } from '@strimz/web-shared/components/shared/turnstile-widget'
import { AuthCard } from '@/components/auth/auth-card'
import { useViewportWidth } from '@/components/auth/auth-methods'
import { readSignupToken, turnstileSizeFor } from '@/lib/auth-flow'
import { syncSession } from '@/lib/auth-sync'
import { ensureEmbeddedWallet } from '@/lib/embedded-wallet'
import { lastPasskeyOffer, shouldOfferPasskey } from '@/lib/passkeys'
import { env } from '@strimz/web-shared/lib/env'
import { safeNextPath, withNext } from '@strimz/web-shared/lib/auth-redirect'

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallback />
    </Suspense>
  )
}

function AuthCallback() {
  const router = useRouter()
  const next = safeNextPath(useSearchParams().get('next'))
  const privy = usePrivyOrNull()
  const { createWallet } = useCreateWallet()
  const [error, setError] = useState<string | null>(null)
  const [needsCheck, setNeedsCheck] = useState(false)
  const viewportWidth = useViewportWidth()
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
      router.replace(withNext('/login', next))
      return
    }
    if (syncingRef.current) return
    syncingRef.current = true
    void doSync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privy?.ready, privy?.authenticated])

  async function doSync(turnstileToken = readSignupToken()) {
    try {
      // The first sync records the wallet address, so it has to exist by then.
      await ensureEmbeddedWallet(privy?.user?.linkedAccounts ?? [], createWallet)
      const r = await syncSession(turnstileToken)
      // A new account needs a fresh bot check, e.g. after the saved one expired.
      if (r.status === 428) {
        if (!env.turnstileSiteKey) {
          console.error(
            '[auth] the API wants a Turnstile token but NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set',
          )
          return setError("Sign-up isn't available right now. Try again later.")
        }
        return setNeedsCheck(true)
      }
      if (!r.ok) return setError(`Sync failed (${r.status})`)
      const body = (await r.json()) as { merchant: Merchant; isNewMerchant: boolean }
      // Always route by the durable flag on the row. `isNewMerchant`
      // is only true the very first time; a merchant who abandoned
      // onboarding on a prior visit would otherwise slip into /app.
      if (!body.merchant.onboardingCompleted) return router.replace('/onboarding')
      const destination = next ?? '/app'
      const accounts = privy?.user?.linkedAccounts ?? []
      router.replace(
        shouldOfferPasskey(accounts, lastPasskeyOffer())
          ? withNext('/passkey', destination)
          : destination,
      )
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (needsCheck && !error) {
    return (
      <AuthCard
        title="One more step"
        description="Confirm you're not a bot to finish creating your account."
      >
        <TurnstileWidget
          action="signup"
          resetKey={0}
          size={turnstileSizeFor(viewportWidth)}
          className="flex w-full justify-center py-2"
          onToken={(token) => {
            if (!token) return
            setNeedsCheck(false)
            void doSync(token)
          }}
        />
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Signing you in" description={error ?? 'Hold on a moment.'}>
      <div className="flex justify-center py-4">
        {error ? (
          <p className="font-poppins text-danger text-sm">{error}</p>
        ) : (
          <Loader2 className="text-brand-text size-6 animate-spin" />
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
