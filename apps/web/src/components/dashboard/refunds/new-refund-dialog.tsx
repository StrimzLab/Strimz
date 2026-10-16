'use client'

import * as React from 'react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@strimz/ui'
import {
  idSchema,
  type RefundCreateOutput,
  type RefundReason,
  type RefundSigningInstructions,
  type Transaction,
} from '@strimz/shared-types'

import { useCreateRefund, useTransaction } from '@/hooks/api'
import { formatTokenAmount, relativeTime } from '@/lib/format'
import { buildRefundInput } from '@/lib/refund-input'

/**
 * Refund creation + on-chain signing flow.
 *
 * Two API calls in sequence:
 *   1. `POST /v1/refunds` — creates the refund row at
 *      `awaiting_signature` and returns the ERC-20 transfer the
 *      merchant needs to sign (token + to + amount).
 *   2. `POST /v1/refunds/:id/signature` — after Privy signs and
 *      broadcasts the transfer, we hand the tx hash back to the API
 *      which flips the row to `submitted`. The indexer then watches
 *      the token contract for the matching Transfer event and marks
 *      the refund `completed`.
 *
 * If step 2 fails (rejected sig, RPC glitch) the row stays at
 * `awaiting_signature` and the row-menu "Sign & submit" action can
 * retry.
 */
export function NewRefundDialog({
  onSignRequested,
  transaction = null,
  trigger,
}: {
  onSignRequested: (args: {
    refundId: string
    instructions: RefundSigningInstructions
  }) => Promise<`0x${string}` | null>
  transaction?: Transaction | null
  trigger?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [transactionId, setTransactionId] = React.useState(transaction?.id ?? '')
  const [amount, setAmount] = React.useState('')
  const [reason, setReason] = React.useState<RefundReason>('customer_request')
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const createMutation = useCreateRefund()
  const typedId = transactionId.trim()
  const lookup = useTransaction(
    !transaction && open && idSchema.safeParse(typedId).success ? typedId : null,
  )
  const target = transaction ?? lookup.data ?? null

  const reset = () => {
    setTransactionId(transaction?.id ?? '')
    setAmount('')
    setReason('customer_request')
    setNote('')
    setError(null)
  }

  const handleCreate = async () => {
    if (!target) return
    const built = buildRefundInput({
      transactionId: target.id,
      amount,
      currency: target.currency,
      maxAmount: target.amount,
      reason,
      note,
    })
    if (!built.ok) {
      setError(built.error)
      return
    }
    setError(null)
    setBusy(true)
    try {
      const out: RefundCreateOutput = await createMutation.mutateAsync(built.input)
      // Hand off to the wallet. Success closes the dialog; a rejected
      // signature leaves the refund at awaiting_signature so the row
      // menu can retry.
      const hash = await onSignRequested({
        refundId: out.refund.id,
        instructions: out.signingInstructions,
      })
      if (hash) {
        setOpen(false)
        reset()
      }
    } catch (err) {
      toast.error(`Refund failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const currency = target?.currency ?? null

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="default">
            <Plus className="mr-1.5 size-4" /> New refund
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create refund</DialogTitle>
          <DialogDescription>
            You will sign the on-chain {currency ?? 'token'} transfer with your Strimz-embedded
            wallet after confirming below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="rf-tx" required>
              Original transaction ID
            </FieldLabel>
            <Input
              id="rf-tx"
              placeholder="cm…"
              value={transactionId}
              readOnly={Boolean(transaction)}
              onChange={(e) => setTransactionId(e.target.value)}
            />
            {!transaction && typedId && lookup.isFetching ? (
              <p className="text-muted-foreground text-xs">Looking up the transaction…</p>
            ) : null}
            {!transaction && typedId && lookup.isError ? (
              <p className="text-xs text-rose-600">No transaction with this ID in this mode.</p>
            ) : null}
            {target ? (
              <p className="text-muted-foreground text-xs">
                {formatTokenAmount(target.amount, target.currency)} paid{' '}
                {relativeTime(target.blockTimestamp)}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="rf-amount" required>
                {currency ? `Amount (${currency})` : 'Amount'}
              </FieldLabel>
              <Input
                id="rf-amount"
                inputMode="decimal"
                placeholder="50.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="rf-reason" required>
                Reason
              </FieldLabel>
              <Select value={reason} onValueChange={(v) => setReason(v as RefundReason)}>
                <SelectTrigger id="rf-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer_request">Customer request</SelectItem>
                  <SelectItem value="product_issue">Product issue</SelectItem>
                  <SelectItem value="duplicate_charge">Duplicate charge</SelectItem>
                  <SelectItem value="fraudulent">Fraudulent</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <FieldLabel htmlFor="rf-note" required={false}>
              Note
            </FieldLabel>
            <Textarea
              id="rf-note"
              placeholder="Optional internal note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreate()} disabled={busy || !target || !amount}>
            {busy ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Working…
              </>
            ) : (
              'Create + sign'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
