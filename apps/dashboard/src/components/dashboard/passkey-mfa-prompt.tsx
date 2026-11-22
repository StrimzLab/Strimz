'use client'

import { useState } from 'react'
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

// Privy pauses every embedded-wallet signature until this completes
// (Transaction MFA, ADR-2026-11-22-passkey-step-up).
export function PasskeyMfaPrompt() {
  const { init, submit, cancel } = useMfa()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useRegisterMfaListener({
    onMfaRequired: () => {
      setError(null)
      setOpen(true)
    },
  })

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const options = await init('passkey')
      if (!options) throw new Error('no passkey challenge')
      await submit('passkey', options)
      setOpen(false)
    } catch (err) {
      console.error('[mfa] passkey confirmation failed', err)
      setError(authErrorMessage(err, 'passkey') ?? 'Your passkey was not used. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next || busy) return
        cancel()
        setOpen(false)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm with your passkey</DialogTitle>
          <DialogDescription>
            This moves money or changes where it goes, so Strimz needs your passkey first.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              cancel()
              setOpen(false)
            }}
          >
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void confirm()}>
            <KeyRound className="size-4" />
            {busy ? 'Waiting for your passkey…' : 'Use my passkey'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
