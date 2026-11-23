'use client'

import { useState, useSyncExternalStore } from 'react'
import { useLinkWithPasskey, usePrivy, useUnlinkPasskey } from '@privy-io/react-auth'
import { KeyRound } from 'lucide-react'
import { Button } from '@strimz/ui'

import { hasPasskeyMfa, useEnrolPasskeyMfa } from '@/hooks/use-passkey-mfa'
import { authErrorMessage } from '@/lib/auth-flow'
import { canRemovePasskey, passkeysOf } from '@/lib/passkeys'

const never = () => () => {}

export function PasskeySettings() {
  const { user } = usePrivy()
  const supported = useSyncExternalStore(
    never,
    () => typeof window.PublicKeyCredential !== 'undefined',
    () => false,
  )
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const enrolMfa = useEnrolPasskeyMfa()
  const [enrolling, setEnrolling] = useState(false)
  const enrol = (u: Parameters<typeof enrolMfa>[0]) => {
    setEnrolling(true)
    enrolMfa(u)
      .catch((err: unknown) => {
        console.error('[settings] passkey MFA enrolment failed', err)
        setError(authErrorMessage(err, 'link'))
      })
      .finally(() => setEnrolling(false))
  }
  const { linkWithPasskey, state } = useLinkWithPasskey({ onSuccess: ({ user: u }) => enrol(u) })
  const { unlink } = useUnlinkPasskey()
  const accounts = user?.linkedAccounts ?? []
  const passkeys = passkeysOf(accounts)
  const adding = state.status !== 'initial' && state.status !== 'error' && state.status !== 'done'

  return (
    <div className="border-border/60 space-y-3 rounded-md border p-3 text-sm">
      <div>
        <div className="font-medium">Passkeys</div>
        <p className="text-muted-foreground text-xs">
          Sign in with your fingerprint, face or device PIN instead of an email code. Your passkey
          also confirms withdrawals, refunds, payout changes, new API keys and webhooks.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Adding or removing a passkey asks for one you already have, so a stolen login can&apos;t
          take your protection away.
        </p>
      </div>
      {user && passkeys.length > 0 && !hasPasskeyMfa(user) && (
        <div className="border-warning-border bg-warning-surface text-warning space-y-2 rounded-md border p-3 text-xs">
          <p>Your passkey can sign you in but can&apos;t confirm sensitive actions yet.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={enrolling}
            onClick={() => enrol(user)}
          >
            {enrolling ? 'Setting up…' : 'Use my passkey for confirmations'}
          </Button>
        </div>
      )}
      {passkeys.length === 0 ? (
        <p className="text-muted-foreground text-xs">No passkeys yet.</p>
      ) : (
        <ul className="divide-border/60 divide-y">
          {passkeys.map((p) => {
            const removable = canRemovePasskey(accounts, p.credentialId)
            return (
              <li
                key={p.credentialId}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <KeyRound className="text-muted-foreground size-4" aria-hidden />
                  {p.label}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-danger"
                  disabled={!removable || removing !== null}
                  title={
                    removable
                      ? undefined
                      : 'Strimz needs a passkey that confirms withdrawals. Add another one first.'
                  }
                  onClick={() => {
                    setError(null)
                    setRemoving(p.credentialId)
                    unlink({ credentialId: p.credentialId })
                      .catch((err: unknown) => {
                        console.error('[settings] removing a passkey failed', err)
                        setError("We couldn't remove that passkey. Try again.")
                      })
                      .finally(() => setRemoving(null))
                  }}
                >
                  {removing === p.credentialId ? 'Removing…' : 'Remove'}
                </Button>
                {!removable && (
                  <p className="text-muted-foreground basis-full text-xs">
                    To remove this one, add another passkey first.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {supported ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={adding}
          onClick={() => {
            setError(null)
            linkWithPasskey().catch((err: unknown) => {
              console.error('[settings] adding a passkey failed', err)
              setError(authErrorMessage(err, 'link'))
            })
          }}
        >
          <KeyRound className="size-4" />
          {adding ? 'Waiting for your device…' : 'Add a passkey'}
        </Button>
      ) : (
        <p className="text-muted-foreground text-xs">This browser can&apos;t make passkeys.</p>
      )}
      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
