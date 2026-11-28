'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Captcha, usePrivy } from '@privy-io/react-auth'
import { TurnstileWidget } from '@strimz/web-shared/components/shared/turnstile-widget'
import { env } from '@strimz/web-shared/lib/env'
import { withNext } from '@strimz/web-shared/lib/auth-redirect'

import { EmailCodeForm } from '@/components/auth/email-code-form'
import { GoogleButton, PasskeyButton } from '@/components/auth/sign-in-buttons'
import { saveSignupToken, turnstileSizeFor } from '@/lib/auth-flow'

/** Sign-up and login methods behind one Turnstile check (ADR-2026-11-21-custom-auth-screens). */
export function AuthMethods({ mode, next }: { mode: 'signup' | 'login'; next: string | null }) {
  const { ready, authenticated } = usePrivy()
  const [human, setHuman] = useState(!env.turnstileSiteKey)
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    // Not router.replace: Privy clears its OAuth params from the URL right after Google
    // returns, and Next takes that as a navigation back here, cancelling ours (#542).
    if (ready && authenticated) window.location.replace(withNext('/callback', next))
  }, [ready, authenticated, next])

  const usable = ready && human
  const viewportWidth = useViewportWidth()

  return (
    <div className="space-y-4">
      <GoogleButton mode={mode} ready={usable} />
      {mode === 'login' && <PasskeyButton ready={usable} />}
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" />
        or
        <span className="bg-border h-px flex-1" />
      </div>
      <EmailCodeForm mode={mode} ready={usable} />
      {/* Privy's own invisible check; Privy enforces it on code requests and sign-ins. */}
      <Captcha />
      <TurnstileWidget
        action={mode}
        resetKey={resetKey}
        size={turnstileSizeFor(viewportWidth)}
        className="flex w-full justify-center"
        onToken={(token) => {
          setHuman(token !== null)
          // The test account asks for its own check when it's created (#588).
          if (token !== null && mode === 'signup') saveSignupToken(token)
        }}
      />
      {env.turnstileSiteKey && !human && (
        <p className="text-muted-foreground text-center text-xs">
          Complete the check above to continue. Not loading?{' '}
          <button type="button" className="underline" onClick={() => setResetKey((k) => k + 1)}>
            Try again
          </button>
        </p>
      )}
    </div>
  )
}

const onResize = (notify: () => void) => {
  window.addEventListener('resize', notify)
  return () => window.removeEventListener('resize', notify)
}

export function useViewportWidth(): number {
  return useSyncExternalStore(
    onResize,
    () => window.innerWidth,
    () => 1024,
  )
}
