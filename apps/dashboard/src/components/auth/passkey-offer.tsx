'use client'

import { useState, useSyncExternalStore } from 'react'
import { useLinkWithPasskey, type User } from '@privy-io/react-auth'
import { KeyRound } from 'lucide-react'
import { Button } from '@strimz/ui'
import { SubmitButton } from '@strimz/web-shared/components/auth/submit-button'

import { useEnrolPasskeyMfa } from '@/hooks/use-passkey-mfa'
import { authErrorMessage } from '@/lib/auth-flow'

const never = () => () => {}

/** Required step: the account needs a passkey that can confirm sensitive actions (ADR-2026-11-23-required-passkey). */
export function PasskeyOffer({
  user,
  linked,
  onDone,
  onSignOut,
}: {
  user: User
  /** A passkey is already on the account but can't confirm yet. */
  linked: boolean
  onDone: () => void
  onSignOut: () => void
}) {
  const supported = useSyncExternalStore(
    never,
    () => typeof window.PublicKeyCredential !== 'undefined',
    () => false,
  )
  const [error, setError] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const enrolMfa = useEnrolPasskeyMfa()

  const enrol = (u: User) => {
    setEnrolling(true)
    enrolMfa(u)
      .then(onDone)
      .catch((err: unknown) => {
        console.error('[auth] passkey MFA enrolment failed', err)
        setError(authErrorMessage(err, 'link'))
      })
      .finally(() => setEnrolling(false))
  }
  const { linkWithPasskey, state } = useLinkWithPasskey({ onSuccess: ({ user: u }) => enrol(u) })
  const busy =
    enrolling || (state.status !== 'initial' && state.status !== 'error' && state.status !== 'done')

  return (
    <div className="space-y-4">
      <div className="border-border/60 bg-muted/30 flex gap-3 rounded-xl border p-4">
        <KeyRound className="text-brand-text mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="text-muted-foreground text-sm">
          {!supported
            ? "This browser can't make passkeys. Open Strimz in a current Chrome, Safari, Edge or Firefox, or use your phone."
            : linked
              ? 'Your account already has a passkey. Set it up to confirm withdrawals and payout changes.'
              : 'Use your fingerprint, face or device PIN. It signs you in and confirms withdrawals and payout changes.'}
        </p>
      </div>
      {supported && linked && (
        <SubmitButton
          type="button"
          isLoading={busy}
          loadingText="Waiting for your device…"
          onClick={() => {
            setError(null)
            enrol(user)
          }}
        >
          <KeyRound className="size-4" />
          Use my passkey for confirmations
        </SubmitButton>
      )}
      {supported && !linked && (
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
      <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  )
}
