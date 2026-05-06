'use client'

import * as React from 'react'
import { Download, MoreHorizontal, Plus, Copy, ExternalLink } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
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
import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { downloadCsv } from '@/lib/csv-export'
import { REFUNDS, type Refund, type RefundStatus } from '@/data/refunds'
import { formatUsdc, relativeTime, shortAddress } from '@/data/_seed'

const STATUS_TONE: Record<RefundStatus, 'positive' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  completed: 'positive',
  submitted: 'info',
  awaiting_signature: 'warning',
  failed: 'danger',
}

export default function RefundsPage() {
  const completed = REFUNDS.filter((r) => r.status === 'completed')
  const totalRefundedUsdc = completed.reduce((s, r) => s + r.amountUsdc, 0)

  const columns: ColumnDef<Refund>[] = React.useMemo(
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
        accessorKey: 'amountUsdc',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="font-mono">{formatUsdc(row.original.amountUsdc)} USDC</span>
        ),
      },
      {
        accessorKey: 'reason',
        header: 'Reason',
        cell: ({ row }) => (
          <span className="capitalize">{row.original.reason.replace('_', ' ')}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusPill tone={STATUS_TONE[row.original.status]}>
            {row.original.status.replace('_', ' ')}
          </StatusPill>
        ),
      },
      {
        accessorKey: 'payerWallet',
        header: 'To wallet',
        cell: ({ row }) => (
          <code className="text-xs">{shortAddress(row.original.payerWallet)}</code>
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
                  <ExternalLink className="mr-2 size-4" /> View on-chain
                </DropdownMenuItem>
              ) : null}
              {row.original.status === 'awaiting_signature' ? (
                <DropdownMenuItem
                  onClick={() =>
                    toast.success(`Re-prompt sent for ${row.original.id.slice(0, 10)}`)
                  }
                >
                  Re-prompt for signature
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
              onClick={() => {
                downloadCsv('refunds.csv', REFUNDS, [
                  { key: 'id', header: 'ID' },
                  { key: 'transactionId', header: 'Original transaction' },
                  { key: 'amountUsdc', header: 'Amount (smallest units)' },
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
          label="Completed (60d)"
          value={`${formatUsdc(totalRefundedUsdc)} USDC`}
          note={`${completed.length} refunds`}
        />
        <Stat
          label="Awaiting signature"
          value={REFUNDS.filter((r) => r.status === 'awaiting_signature').length.toString()}
        />
        <Stat
          label="Failed"
          value={REFUNDS.filter((r) => r.status === 'failed').length.toString()}
        />
      </div>

      <DataTable
        columns={columns}
        data={REFUNDS}
        searchPlaceholder="Search by refund ID, original tx, wallet…"
        emptyTitle="No refunds"
        emptyDescription="Refunds you create from confirmed transactions appear here."
      />
    </div>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="shadow-sub-card border-border/60 bg-background rounded-xl border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-sora mt-1 text-2xl font-semibold">{value}</div>
      {note ? <div className="text-muted-foreground mt-1 text-xs">{note}</div> : null}
    </div>
  )
}

function NewRefundDialog() {
  const [open, setOpen] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="text-accent-foreground">
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
            <Input id="rf-tx" placeholder="tx_…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="rf-amount">Amount (USDC)</Label>
              <Input id="rf-amount" type="number" step="0.01" placeholder="50.00" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rf-reason">Reason</Label>
              <Select defaultValue="customer_request">
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
            <Textarea id="rf-note" placeholder="Optional internal note" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setOpen(false)
              toast.success('Refund created — open your wallet to sign')
            }}
          >
            Create + sign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
