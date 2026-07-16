'use client'

import * as React from 'react'
import { useWallets } from '@privy-io/react-auth'
import { Copy, Download, ExternalLink, Loader2, MoreHorizontal, PenLine, Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { encodeFunctionData, erc20Abi, isAddress, parseUnits } from 'viem'
import { toast } from 'sonner'
import { env } from '@/lib/env'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@strimz/ui'
import type {
  Refund,
  RefundCreateOutput,
  RefundReason,
  RefundSigningInstructions,
  RefundStatus,
} from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { TokenLogo } from '@/components/shared/token-logo'
import { downloadCsv } from '@/lib/csv-export'
import { formatTokenAmount, relativeTime, shortAddress, tokenAmountToNumber } from '@/lib/format'
import { useCreateRefund, useRefunds, useSubmitRefundSignature } from '@/hooks/api'

const STATUS_TONE: Record<RefundStatus, 'positive' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  completed: 'positive',
  submitted: 'info',
  awaiting_signature: 'warning',
  pending: 'info',
  failed: 'danger',
  cancelled: 'neutral',
}

interface RefundsView {
  rows: Refund[]
  completed: Refund[]
  refundedUsdc: number
  awaiting: number
  failed: number
}

function projectRefunds(page: { data: Refund[] }): RefundsView {
  const completed = page.data.filter((r) => r.status === 'completed')
  return {
    rows: page.data,
    completed,
    refundedUsdc: completed.reduce((s, r) => s + tokenAmountToNumber(r.amount), 0),
    awaiting: page.data.filter((r) => r.status === 'awaiting_signature').length,
    failed: page.data.filter((r) => r.status === 'failed').length,
  }
}

/**
 * Signs the ERC-20 transfer that constitutes the actual on-chain
 * refund. Uses the merchant's Privy embedded wallet (the same key
 * that owns the payout address). Once broadcast we POST the tx hash
 * back to `/v1/refunds/:id/signature` so the row flips from
 * `awaiting_signature` to `submitted` and the indexer takes over.
 */
function useRefundSigner() {
  const { wallets } = useWallets()
  const submit = useSubmitRefundSignature()

  const embedded = React.useMemo(
    () => wallets.find((w) => w.walletClientType === 'privy') ?? null,
    [wallets],
  )

  const [broadcasting, setBroadcasting] = React.useState(false)

  const sign = React.useCallback(
    async ({
      refundId,
      instructions,
    }: {
      refundId: string
      instructions: RefundSigningInstructions
    }) => {
      if (!embedded) {
        toast.error('Connect your Strimz-embedded wallet before signing.')
        return null
      }
      if (!isAddress(instructions.to) || !isAddress(instructions.token)) {
        toast.error('Invalid signing instructions — refund not sent.')
        return null
      }
      setBroadcasting(true)
      try {
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [instructions.to as `0x${string}`, BigInt(instructions.amount)],
        })
        const provider = await embedded.getEthereumProvider()
        const hash = (await provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: embedded.address as `0x${string}`,
              to: instructions.token,
              data,
              value: '0x0',
            },
          ],
        })) as `0x${string}`
        await submit.mutateAsync({ id: refundId, refundTxHash: hash })
        return hash
      } finally {
        setBroadcasting(false)
      }
    },
    [embedded, submit],
  )

  return {
    sign,
    isSigning: broadcasting || submit.isPending,
    hasEmbeddedWallet: !!embedded,
  }
}

export default function RefundsPage() {
  const { data, isLoading, isError, error, refetch } = useRefunds(
    { limit: 100 },
    { select: projectRefunds },
  )
  const { sign: signRefund, isSigning } = useRefundSigner()
  const [signingId, setSigningId] = React.useState<string | null>(null)

  const handleSignRow = React.useCallback(
    async (refund: Refund) => {
      // We only have `signingInstructions` on the create call. For a
      // row already awaiting_signature, we reconstruct the transfer
      // from the refund + transaction fields. Amount is on the refund;
      // the token address must come from currency + mode via a small
      // client-side lookup.
      const tokenAddress = tokenAddressForCurrency(refund.currency)
      if (!tokenAddress) {
        toast.error(`No token address configured for ${refund.currency}.`)
        return
      }
      setSigningId(refund.id)
      try {
        await signRefund({
          refundId: refund.id,
          instructions: {
            token: tokenAddress,
            to: refund.payerAddress,
            amount: refund.amount,
            note: refund.note ?? `Refund for transaction ${refund.transactionId}`,
          },
        })
      } catch (err) {
        toast.error(`Sign failed: ${(err as Error).message}`)
      } finally {
        setSigningId(null)
      }
    },
    [signRefund],
  )

  const columns = React.useMemo<ColumnDef<Refund>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Refund',
        cell: ({ row }) => <code className="text-xs">{row.original.id.slice(0, 14)}…</code>,
      },
      {
        accessorKey: 'transactionId',
        header: 'Original tx',
        cell: ({ row }) => (
          <code className="text-muted-foreground text-xs">
            {row.original.transactionId.slice(0, 14)}…
          </code>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-mono">
            <TokenLogo symbol={row.original.currency} size={14} />
            {formatTokenAmount(row.original.amount, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: 'reason',
        header: 'Reason',
        cell: ({ row }) => (
          <span className="capitalize">{row.original.reason.replace(/_/g, ' ')}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusPill tone={STATUS_TONE[row.original.status]}>
            {row.original.status.replace(/_/g, ' ')}
          </StatusPill>
        ),
      },
      {
        accessorKey: 'payerAddress',
        header: 'To wallet',
        cell: ({ row }) => (
          <code className="text-xs">{shortAddress(row.original.payerAddress)}</code>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{relativeTime(row.original.createdAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const rf = row.original
          const canSign = rf.status === 'awaiting_signature'
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="size-8 p-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {canSign ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => void handleSignRow(rf)}
                      disabled={isSigning && signingId === rf.id}
                    >
                      {isSigning && signingId === rf.id ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <PenLine className="mr-2 size-4" />
                      )}
                      Sign & submit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
                <DropdownMenuItem
                  onClick={() =>
                    navigator.clipboard
                      .writeText(rf.id)
                      .then(() => toast.success('Refund ID copied'))
                  }
                >
                  <Copy className="mr-2 size-4" /> Copy ID
                </DropdownMenuItem>
                {rf.refundTxHash ? (
                  <DropdownMenuItem
                    onClick={() =>
                      navigator.clipboard
                        .writeText(rf.refundTxHash!)
                        .then(() => toast.success('Tx hash copied'))
                    }
                  >
                    <ExternalLink className="mr-2 size-4" /> Copy tx hash
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [handleSignRow, isSigning, signingId],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refunds"
        docsSlug="refunds"
        description="Issue full or partial refunds. You sign each refund from your own wallet, so Strimz never holds your funds."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data || data.rows.length === 0}
              onClick={() => {
                if (!data) return
                downloadCsv('refunds.csv', data.rows, [
                  { key: 'id', header: 'ID' },
                  { key: 'transactionId', header: 'Original transaction' },
                  { key: 'amount', header: 'Amount (raw)' },
                  { key: 'currency', header: 'Currency' },
                  { key: 'reason', header: 'Reason' },
                  { key: 'status', header: 'Status' },
                  { key: 'refundTxHash', header: 'On-chain tx' },
                  { key: 'createdAt', header: 'Created' },
                  { key: 'completedAt', header: 'Completed' },
                ])
                toast.success('Exported refunds.csv')
              }}
            >
              <Download className="mr-1.5 size-4" /> Export CSV
            </Button>
            <NewRefundDialog onSignRequested={signRefund} />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Completed"
          value={
            data
              ? `${data.refundedUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`
              : '—'
          }
          note={data ? `${data.completed.length} refunds` : undefined}
        />
        <Stat label="Awaiting signature" value={data ? data.awaiting.toString() : '—'} />
        <Stat
          label="Failed"
          value={data ? data.failed.toString() : '—'}
          tone={data && data.failed > 0 ? 'danger' : undefined}
        />
      </div>

      {isError ? (
        <ErrorBanner message={error?.message ?? 'Failed to load refunds'} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          loading={isLoading}
          searchPlaceholder="Search by refund ID, original tx, wallet…"
          emptyTitle="No refunds"
          emptyDescription="Refunds you create from confirmed transactions appear here."
        />
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string
  note?: string
  tone?: 'danger'
}) {
  return (
    <div className="shadow-sub-card border-border/60 bg-background rounded-xl border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={[
          'font-sora mt-1 text-2xl font-semibold',
          tone === 'danger' ? 'text-rose-600' : '',
        ].join(' ')}
      >
        {value}
      </div>
      {note ? <div className="text-muted-foreground mt-1 text-xs">{note}</div> : null}
    </div>
  )
}

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
function NewRefundDialog({
  onSignRequested,
}: {
  onSignRequested: (args: {
    refundId: string
    instructions: RefundSigningInstructions
  }) => Promise<`0x${string}` | null>
}) {
  const [open, setOpen] = React.useState(false)
  const [transactionId, setTransactionId] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [reason, setReason] = React.useState<RefundReason>('customer_request')
  const [note, setNote] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const createMutation = useCreateRefund()

  const reset = () => {
    setTransactionId('')
    setAmount('')
    setReason('customer_request')
    setNote('')
  }

  const handleCreate = async () => {
    if (!transactionId || !amount) return
    let raw: string
    try {
      raw = parseUnits(amount, 6).toString()
    } catch {
      toast.error('Enter a valid amount')
      return
    }
    setBusy(true)
    try {
      const out: RefundCreateOutput = await createMutation.mutateAsync({
        transactionId: transactionId.trim(),
        amount: raw,
        reason,
        note: note || undefined,
      })
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

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="default">
          <Plus className="mr-1.5 size-4" /> New refund
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create refund</DialogTitle>
          <DialogDescription>
            You will sign the on-chain USDC transfer with your Strimz-embedded wallet after
            confirming below.
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
              onChange={(e) => setTransactionId(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <FieldLabel htmlFor="rf-amount" required>
                Amount (USDC)
              </FieldLabel>
              <Input
                id="rf-amount"
                type="number"
                step="0.01"
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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreate()} disabled={busy || !transactionId || !amount}>
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

function tokenAddressForCurrency(currency: 'USDC' | 'EURC'): `0x${string}` | null {
  const raw = currency === 'USDC' ? env.usdcAddress : process.env.NEXT_PUBLIC_STRIMZ_EURC_ADDRESS
  if (!raw || !isAddress(raw)) return null
  return raw as `0x${string}`
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border-border/60 bg-background flex items-center justify-between rounded-xl border p-4">
      <div>
        <div className="text-sm font-medium">Couldn’t load refunds</div>
        <div className="text-muted-foreground text-xs">{message}</div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
