'use client'

import * as React from 'react'
import { Download, MoreHorizontal, ExternalLink, Copy, Ban } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { TokenLogo } from '@/components/shared/token-logo'
import { downloadCsv } from '@/lib/csv-export'
import {
  PAYMENT_SESSIONS,
  type PaymentSession,
  type PaymentSessionStatus,
} from '@/data/payment-sessions'
import { formatUsdc, relativeTime, shortAddress } from '@/data/_seed'

const STATUS_TONE: Record<
  PaymentSessionStatus,
  'positive' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  confirmed: 'positive',
  pending: 'info',
  cancelled: 'neutral',
  expired: 'warning',
  refunded: 'danger',
}

export default function PaymentSessionsPage() {
  const [statusFilter, setStatusFilter] = React.useState<PaymentSessionStatus | 'all'>('all')
  const filtered = React.useMemo(
    () =>
      statusFilter === 'all'
        ? PAYMENT_SESSIONS
        : PAYMENT_SESSIONS.filter((s) => s.status === statusFilter),
    [statusFilter],
  )
  const totalConfirmedUsdc = PAYMENT_SESSIONS.filter((s) => s.status === 'confirmed').reduce(
    (s, p) => s + p.amountUsdc,
    0,
  )

  const columns: ColumnDef<PaymentSession>[] = React.useMemo(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <code className="text-muted-foreground text-xs">{row.original.id.slice(0, 14)}…</code>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => <span className="font-medium">{row.original.description}</span>,
      },
      {
        accessorKey: 'amountUsdc',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-mono">
            <TokenLogo symbol="USDC" size={14} />
            {formatUsdc(row.original.amountUsdc)}
          </span>
        ),
      },
      {
        accessorKey: 'customerWallet',
        header: 'Customer',
        cell: ({ row }) =>
          row.original.customerWallet ? (
            <code className="text-xs">{shortAddress(row.original.customerWallet)}</code>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusPill tone={STATUS_TONE[row.original.status]}>{row.original.status}</StatusPill>
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
                className="text-xs"
                onClick={() =>
                  navigator.clipboard
                    .writeText(row.original.id)
                    .then(() => toast.success('Session ID copied'))
                }
              >
                <Copy className="size-3" /> Copy ID
              </DropdownMenuItem>
              {row.original.txHash ? (
                <DropdownMenuItem
                  className="-mt-2 text-xs"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(row.original.txHash!)
                      .then(() => toast.success('Tx hash copied'))
                  }
                >
                  <ExternalLink className="size-3" /> View on-chain
                </DropdownMenuItem>
              ) : null}
              {row.original.status === 'pending' ? (
                <DropdownMenuItem
                  className="-mt-2 text-xs text-rose-600 focus:text-rose-600"
                  onClick={() => toast.success(`Session ${row.original.id.slice(0, 10)} cancelled`)}
                >
                  <Ban className="size-3" /> Cancel session
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
        title="Payment sessions"
        description="One-time hosted checkouts you've created. Each session has its own link you can send to a customer."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              downloadCsv('payment-sessions.csv', PAYMENT_SESSIONS, [
                { key: 'id', header: 'ID' },
                { key: 'description', header: 'Description' },
                { key: 'amountUsdc', header: 'Amount (smallest units)' },
                { key: 'customerWallet', header: 'Customer wallet' },
                { key: 'status', header: 'Status' },
                { key: 'txHash', header: 'On-chain tx' },
                { key: 'createdAt', header: 'Created' },
                { key: 'expiresAt', header: 'Expires' },
              ])
              toast.success('Exported payment-sessions.csv')
            }}
          >
            <Download className="mr-1.5 size-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total sessions" value={PAYMENT_SESSIONS.length.toLocaleString()} />
        <Stat label="Confirmed (60d)" value={`${formatUsdc(totalConfirmedUsdc)} USDC`} />
        <Stat
          label="Pending"
          value={PAYMENT_SESSIONS.filter((s) => s.status === 'pending').length.toLocaleString()}
        />
        <Stat
          label="Conversion (60d)"
          value={`${Math.round((100 * PAYMENT_SESSIONS.filter((s) => s.status === 'confirmed').length) / PAYMENT_SESSIONS.length)}%`}
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Search by ID, description, customer wallet…"
        emptyTitle="No sessions"
        emptyDescription="Create a payment session via the API or SDK to see one appear here."
        toolbar={
          <div className="flex flex-wrap items-center gap-1">
            {(['all', 'pending', 'confirmed', 'cancelled', 'expired', 'refunded'] as const).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={[
                    'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
                    statusFilter === s
                      ? 'border-[#02C76A] bg-[#02C76A]/10 text-[#02C76A]'
                      : 'border-border/60 hover:bg-muted',
                  ].join(' ')}
                >
                  {s === 'all' ? 'All' : s}
                </button>
              ),
            )}
          </div>
        }
      />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="shadow-sub-card border-border/60 bg-background rounded-xl border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-sora mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}
