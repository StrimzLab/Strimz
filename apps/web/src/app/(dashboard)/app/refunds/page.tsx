'use client'

import * as React from 'react'
import { Download, MoreHorizontal, Plus, Copy, ExternalLink } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { parseUnits } from 'viem'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@strimz/ui'
import type { Refund, RefundReason, RefundStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { TokenLogo } from '@/components/shared/token-logo'
import { downloadCsv } from '@/lib/csv-export'
import { formatTokenAmount, relativeTime, shortAddress, tokenAmountToNumber } from '@/lib/format'
import { useCreateRefund, useRefunds } from '@/hooks/api'

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

export default function RefundsPage() {
  const { data, isLoading, isError, error, refetch } = useRefunds(
    { limit: 100 },
    { select: projectRefunds },
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
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="size-8 p-0">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() =>
                  navigator.clipboard
                    .writeText(row.original.id)
                    .then(() => toast.success('Refund ID copied'))
                }
              >
                <Copy className="mr-2 size-4" /> Copy ID
              </DropdownMenuItem>
              {row.original.refundTxHash ? (
                <DropdownMenuItem
                  onClick={() =>
                    navigator.clipboard
                      .writeText(row.original.refundTxHash!)
                      .then(() => toast.success('Tx hash copied'))
                  }
                >
                  <ExternalLink className="mr-2 size-4" /> Copy tx hash
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refunds"
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
            <NewRefundDialog />
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
 * Refund creation flow.
 *
 * The amount field collects USDC as a decimal string (`"50.00"`). We
 * scale to 6-decimal raw via `parseUnits` before posting — the API
 * accepts the raw bigint form via `tokenAmountSchema`. Doing the
 * conversion at the boundary keeps the component shape natural for the
 * merchant while preserving the API's source of truth.
 */
function NewRefundDialog() {
  const [open, setOpen] = React.useState(false)
  const [transactionId, setTransactionId] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [reason, setReason] = React.useState<RefundReason>('customer_request')
  const [note, setNote] = React.useState('')

  const createMutation = useCreateRefund()

  const reset = () => {
    setTransactionId('')
    setAmount('')
    setReason('customer_request')
    setNote('')
  }

  const handleCreate = () => {
    if (!transactionId || !amount) return
    let raw: string
    try {
      raw = parseUnits(amount, 6).toString()
    } catch {
      toast.error('Enter a valid amount')
      return
    }
    createMutation.mutate(
      {
        transactionId,
        amount: raw,
        reason,
        note: note || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false)
          reset()
        },
      },
    )
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
            You will be prompted to sign the on-chain transfer with your payout wallet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="rf-tx">Original transaction ID</Label>
            <Input
              id="rf-tx"
              placeholder="tx_…"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="rf-amount">Amount (USDC)</Label>
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
              <Label htmlFor="rf-reason">Reason</Label>
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
            <Label htmlFor="rf-note">Note</Label>
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
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || !transactionId || !amount}
          >
            {createMutation.isPending ? 'Submitting…' : 'Create + sign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
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
