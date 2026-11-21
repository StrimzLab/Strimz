'use client'

import { useState, useSyncExternalStore } from 'react'
import { useLinkWithPasskey } from '@privy-io/react-auth'
import { KeyRound } from 'lucide-react'
import { Button } from '@strimz/ui'
import { SubmitButton } from '@strimz/web-shared/components/auth/submit-button'

import { authErrorMessage } from '@/lib/auth-flow'

const never = () => () => {}

/** Optional: adding a passkey never blocks the way on. */
export function PasskeyOffer({ onDone }: { onDone: () => void }) {
  const supported = useSyncExternalStore(
    never,
    () => typeof window.PublicKeyCredential !== 'undefined',
    () => false,
  )
  const [error, setError] = useState<string | null>(null)
  const { linkWithPasskey, state } = useLinkWithPasskey({ onSuccess: onDone })
  const busy = state.status !== 'initial' && state.status !== 'error' && state.status !== 'done'

  return (
    <div className="space-y-4">
      <div className="border-border/60 bg-muted/30 flex gap-3 rounded-xl border p-4">
        <KeyRound className="text-brand-text mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="text-muted-foreground text-sm">
          {supported
            ? 'Sign in with your fingerprint, face or device PIN instead of waiting for an email code. You can add or remove passkeys later in Settings.'
            : "This browser can't make passkeys. You can add one later from Settings on another device."}
        </p>
      </div>
      {supported && (
        <SubmitButton
          type="button"
          isLoading={busy}
          loadingText="Waiting for your device…"
          onClick={() => {
            setError(null)
            linkWithPasskey().catch((err: unknown) => {
              console.error('[auth] adding a passkey failed', err)
              setError(authErrorMessage(err, 'link'))
            })
          }}
        >
          <KeyRound className="size-4" />
          Add a passkey
        </SubmitButton>
      )}
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={onDone}>
        {supported ? 'Skip for now' : 'Continue'}
      </Button>
    </div>
  )
}
