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
import type { PaymentSession, PaymentSessionStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { TokenLogo } from '@/components/shared/token-logo'
import { downloadCsv } from '@/lib/csv-export'
import { formatTokenAmount, relativeTime, shortAddress, tokenAmountToNumber } from '@/lib/format'
import { useCancelPaymentSession, usePaymentSessions, usePrefetchPaymentSession } from '@/hooks/api'

/**
 * Tone mapping for the seven canonical session statuses. Kept on the
 * page rather than the StatusPill so the dashboard's other surfaces
 * (transactions, subscriptions) can tone-map their own enums without
 * cross-contamination.
 */
const STATUS_TONE: Record<
  PaymentSessionStatus,
  'positive' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  confirmed: 'positive',
  created: 'info',
  awaiting_payment: 'info',
  submitted: 'info',
  failed: 'danger',
  expired: 'warning',
  cancelled: 'neutral',
}

const FILTER_OPTIONS: ReadonlyArray<PaymentSessionStatus | 'all'> = [
  'all',
  'created',
  'awaiting_payment',
  'submitted',
  'confirmed',
  'failed',
  'expired',
  'cancelled',
]

/**
 * Pre-computed view-model. What the page actually renders. Lives
 * outside React state so the `usePaymentSessions` `select` projection
 * returns the same shape every page.
 */
interface PaymentSessionsView {
  rows: PaymentSession[]
  total: number
  confirmedCount: number
  confirmedTotal: string
  pendingCount: number
  conversionRate: number
}

function project(page: { data: PaymentSession[] }): PaymentSessionsView {
  const rows = page.data
  const confirmedRows = rows.filter((s) => s.status === 'confirmed')
  const confirmedTotalRaw = confirmedRows.reduce((sum, r) => sum + tokenAmountToNumber(r.amount), 0)
  return {
    rows,
    total: rows.length,
    confirmedCount: confirmedRows.length,
    confirmedTotal: confirmedTotalRaw.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    }),
    pendingCount: rows.filter(
      (s) => s.status === 'created' || s.status === 'awaiting_payment' || s.status === 'submitted',
    ).length,
    conversionRate: rows.length === 0 ? 0 : Math.round((100 * confirmedRows.length) / rows.length),
  }
}

export default function PaymentSessionsPage() {
  const [statusFilter, setStatusFilter] = React.useState<PaymentSessionStatus | 'all'>('all')

  // Query params object is memoised so the TanStack Query key stays
  // referentially stable. Otherwise every parent re-render bumps the
  // key and refetches.
  const queryParams = React.useMemo(
    () => ({ status: statusFilter === 'all' ? undefined : statusFilter, limit: 100 }),
    [statusFilter],
  )

  const { data, isLoading, isError, error, refetch } = usePaymentSessions(queryParams, {
    // `select` projects the page shape into the view-model the page
    // renders. The reference is stable across re-renders as long as
    // the underlying page didn't change. Saves the JSX from
    // re-deriving stats on every parent render.
    select: project,
  })

  const prefetch = usePrefetchPaymentSession()
  const cancelMutation = useCancelPaymentSession()

  const columns = React.useMemo<ColumnDef<PaymentSession>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <code
            className="text-muted-foreground text-xs"
            // Prefetch the session detail when the row is in the user's
            // cursor. Clicking through feels instant. Hover-prefetch
            // is the cheapest UX win TanStack Query offers.
            onMouseEnter={() => void prefetch(row.original.id)}
            onFocus={() => void prefetch(row.original.id)}
          >
            {row.original.id.slice(0, 14)}…
          </code>
        ),
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => <span className="font-medium">{row.original.description ?? '—'}</span>,
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
        accessorKey: 'payerWalletAddress',
        header: 'Customer',
        cell: ({ row }) =>
          row.original.payerWalletAddress ? (
            <code className="text-xs">{shortAddress(row.original.payerWalletAddress)}</code>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
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
          const session = row.original
          const cancelable =
            session.status === 'created' ||
            session.status === 'awaiting_payment' ||
            session.status === 'submitted'
          return (
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
                      .writeText(session.id)
                      .then(() => toast.success('Session ID copied'))
                  }
                >
                  <Copy className="size-3" /> Copy ID
                </DropdownMenuItem>
                {session.onchainTxHash ? (
                  <DropdownMenuItem
                    className="-mt-2 text-xs"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(session.onchainTxHash!)
                        .then(() => toast.success('Tx hash copied'))
                    }
                  >
                    <ExternalLink className="size-3" /> Copy tx hash
                  </DropdownMenuItem>
                ) : null}
                {cancelable ? (
                  <DropdownMenuItem
                    className="-mt-2 text-xs text-rose-600 focus:text-rose-600"
                    onClick={() => cancelMutation.mutate(session.id)}
                    disabled={cancelMutation.isPending}
                  >
                    <Ban className="size-3" /> Cancel session
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [cancelMutation, prefetch],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment sessions"
        docsSlug="payment-sessions"
        description="One-time hosted checkouts you've created. Each session has its own link you can send to a customer."
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={!data || data.rows.length === 0}
            onClick={() => {
              if (!data) return
              downloadCsv('payment-sessions.csv', data.rows, [
                { key: 'id', header: 'ID' },
                { key: 'description', header: 'Description' },
                { key: 'amount', header: 'Amount (raw)' },
                { key: 'currency', header: 'Currency' },
                { key: 'payerWalletAddress', header: 'Customer wallet' },
                { key: 'status', header: 'Status' },
                { key: 'onchainTxHash', header: 'On-chain tx' },
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
        <Stat label="Total sessions" value={data ? data.total.toLocaleString() : '—'} />
        <Stat label="Confirmed" value={data ? `${data.confirmedTotal} USDC` : '—'} />
        <Stat label="In-flight" value={data ? data.pendingCount.toLocaleString() : '—'} />
        <Stat label="Conversion" value={data ? `${data.conversionRate}%` : '—'} />
      </div>

      {isError ? (
        <ErrorBanner
          message={error?.message ?? 'Failed to load payment sessions'}
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          loading={isLoading}
          searchPlaceholder="Search by ID, description, customer wallet…"
          emptyTitle="No sessions"
          emptyDescription="Create a payment session via the API or SDK to see one appear here."
          toolbar={
            <div className="flex flex-wrap items-center gap-1">
              {FILTER_OPTIONS.map((s) => (
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
                  {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          }
        />
      )}
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

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border-border/60 bg-background flex items-center justify-between rounded-xl border p-4">
      <div>
        <div className="text-sm font-medium">Couldn’t load payment sessions</div>
        <div className="text-muted-foreground text-xs">{message}</div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
