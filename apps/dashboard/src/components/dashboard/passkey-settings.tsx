'use client'

import { useState, useSyncExternalStore } from 'react'
import { useLinkWithPasskey, usePrivy, useUnlinkPasskey } from '@privy-io/react-auth'
import { KeyRound } from 'lucide-react'
import { Button } from '@strimz/ui'

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
  const { linkWithPasskey, state } = useLinkWithPasskey()
  const { unlink } = useUnlinkPasskey()
  const accounts = user?.linkedAccounts ?? []
  const passkeys = passkeysOf(accounts)
  const adding = state.status !== 'initial' && state.status !== 'error' && state.status !== 'done'

  return (
    <div className="border-border/60 space-y-3 rounded-md border p-3 text-sm">
      <div>
        <div className="font-medium">Passkeys</div>
        <p className="text-muted-foreground text-xs">
          Sign in with your fingerprint, face or device PIN instead of an email code.
        </p>
      </div>
      {passkeys.length === 0 ? (
        <p className="text-muted-foreground text-xs">No passkeys yet.</p>
      ) : (
        <ul className="divide-border/60 divide-y">
          {passkeys.map((p) => {
            const removable = canRemovePasskey(accounts, p.credentialId)
            return (
              <li key={p.credentialId} className="flex items-center justify-between gap-3 py-2">
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
                      : "This is your only way to sign in, so it can't be removed."
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
