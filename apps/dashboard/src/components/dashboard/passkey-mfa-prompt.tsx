'use client'

import { useRef, useState } from 'react'
import { useMfa, useRegisterMfaListener } from '@privy-io/react-auth'
import { KeyRound } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@strimz/ui'

import { authErrorMessage } from '@/lib/auth-flow'

// The only MFA screen (Privy's own is off: mfa.noPromptOnMfaRequired). Privy pauses the wallet
// action or passkey change until this verifies or cancels (ADR-2026-11-22-passkey-step-up).
export function PasskeyMfaPrompt() {
  const { init, submit, cancel } = useMfa()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const attempt = useRef(0)

  useRegisterMfaListener({
    onMfaRequired: () => {
      setError(null)
      setOpen(true)
    },
  })

  function close() {
    attempt.current += 1
    setBusy(false)
    setOpen(false)
  }

  // Works while the passkey prompt is still open; an answer that arrives later is ignored.
  function abandon() {
    cancel()
    close()
  }

  async function confirm() {
    const mine = ++attempt.current
    setBusy(true)
    setError(null)
    try {
      const options = await init('passkey')
      if (!options) throw new Error('no passkey challenge')
      await submit('passkey', options)
      if (mine === attempt.current) close()
    } catch (err) {
      if (mine !== attempt.current) return
      console.error('[mfa] passkey confirmation failed', err)
      setError(authErrorMessage(err, 'passkey') ?? 'Your passkey was not used. Try again.')
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) abandon()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm with your passkey</DialogTitle>
          <DialogDescription>
            This moves money, changes where it goes or changes your passkeys, so Strimz needs your
            passkey first.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={abandon}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void confirm()}>
            <KeyRound className="size-4" />
            {busy ? 'Waiting for your passkey…' : error ? 'Try again' : 'Use my passkey'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
