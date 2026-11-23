'use client'

import * as React from 'react'
import { encodeFunctionData, type Hex } from 'viem'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Card, CardContent, FieldLabel, Input } from '@strimz/ui'

import {
  ConfirmActionDialog,
  type PendingConfirm,
} from '@strimz/web-shared/components/dashboard/confirm-action-dialog'
import type { SafeState } from '@strimz/web-shared/lib/admin-api'
import { safeConsoleAbis } from '@strimz/web-shared/lib/safe-console'
import { adminKeys } from '@/hooks/admin'
import type { useOwnerWallet } from '@/hooks/use-owner-wallet'

// The guardian acts alone and pays its own tiny fee: the contracts only accept a pause or a
// cancel sent by the guardian's wallet itself (ADR-2026-11-23-safe-console).
export function GuardianPanel({
  state,
  chainId,
  wallet,
  explorerTx,
}: {
  state: SafeState
  chainId: number
  wallet: ReturnType<typeof useOwnerWallet>
  explorerTx: (hash: string) => string
}) {
  const qc = useQueryClient()
  const [pending, setPending] = React.useState<PendingConfirm | null>(null)
  const [operationId, setOperationId] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  async function send(to: `0x${string}`, data: Hex, done: string) {
    setBusy(true)
    try {
      const hash = await wallet.send(chainId, to, data)
      toast.success(done, {
        action: { label: 'View', onClick: () => window.open(explorerTx(hash), '_blank') },
      })
      await qc.invalidateQueries({ queryKey: adminKeys.safe() })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Your wallet did not send it.')
    } finally {
      setBusy(false)
    }
  }

  const pause = (contract: 'payments' | 'subscriptions', label: string) =>
    setPending({
      copy: {
        title: `Pause ${label}?`,
        description: `No ${label.toLowerCase()} go through until two owners unpause it. Your wallet sends this and pays a fee of well under 0.01 USDC.`,
        confirmLabel: `Pause ${label}`,
      },
      run: () =>
        void send(
          state.contracts[contract],
          encodeFunctionData({ abi: safeConsoleAbis.pausable, functionName: 'pause' }),
          `${label} paused`,
        ),
    })

  function cancel(e: React.FormEvent) {
    e.preventDefault()
    if (!/^0x[0-9a-fA-F]{64}$/u.test(operationId)) {
      toast.error('Enter the 66-character operation ID.')
      return
    }
    setPending({
      copy: {
        title: 'Cancel this scheduled change?',
        description: 'It will never run. Your wallet sends this and pays a tiny fee.',
        confirmLabel: 'Cancel the change',
      },
      run: () =>
        void send(
          state.timelock,
          encodeFunctionData({
            abi: safeConsoleAbis.timelock,
            functionName: 'cancel',
            args: [operationId as Hex],
          }),
          'Scheduled change cancelled',
        ),
    })
  }

  return (
    <Card className="border-warning-border">
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="font-sora text-base font-semibold">Guardian</h2>
          <p className="text-muted-foreground text-sm">
            You can stop payments at once, on your own. Turning them back on needs two owners.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="text-danger"
            disabled={busy || state.paused.payments}
            onClick={() => pause('payments', 'Payments')}
          >
            {state.paused.payments ? 'Payments paused' : 'Pause Payments'}
          </Button>
          <Button
            variant="outline"
            className="text-danger"
            disabled={busy || state.paused.subscriptions}
            onClick={() => pause('subscriptions', 'Subscriptions')}
          >
            {state.paused.subscriptions ? 'Subscriptions paused' : 'Pause Subscriptions'}
          </Button>
        </div>
        <form className="space-y-2" onSubmit={cancel} noValidate>
          <FieldLabel htmlFor="guardian-operation" required>
            Scheduled change to cancel
          </FieldLabel>
          <div className="flex flex-wrap gap-2">
            <Input
              id="guardian-operation"
              className="min-w-0 flex-1 font-mono text-xs"
              placeholder="Operation ID, 0x…"
              value={operationId}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setOperationId(e.target.value.trim())}
            />
            <Button type="submit" variant="outline" disabled={busy}>
              Cancel it
            </Button>
          </div>
        </form>
        <ConfirmActionDialog pending={pending} onClose={() => setPending(null)} />
      </CardContent>
    </Card>
  )
}
