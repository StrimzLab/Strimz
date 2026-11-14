'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
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

import { PageHeader } from '@strimz/web-shared/components/dashboard/page-header'
import { NewPaymentSessionDialog } from '@/components/dashboard/payment-sessions/new-payment-session-dialog'
import {
  DataTable,
  StatusPill,
  type StatusTone,
} from '@strimz/web-shared/components/dashboard/data-table'
import {
  DateFilter,
  MultiSelectFilter,
  filterOptions,
  useDateRange,
  useTableFilters,
} from '@strimz/web-shared/components/dashboard/filter-bar'
import { dateFilter, multiFilter } from '@strimz/web-shared/lib/table-filters'
import { TokenLogo } from '@strimz/web-shared/components/shared/token-logo'
import { downloadCsv } from '@/lib/csv-export'
import { formatTokenAmount, relativeTime, shortAddress } from '@strimz/web-shared/lib/format'
import { paymentSessionCards, summaryValue } from '@/lib/stats-summary'
import type { LoadedRows } from '@strimz/web-shared/lib/cursor-pages'
import { cancelPaymentSessionConfirm } from '@strimz/web-shared/lib/destructive-actions'
import {
  ConfirmActionDialog,
  type PendingConfirm,
} from '@strimz/web-shared/components/dashboard/confirm-action-dialog'
import {
  serverRowsOf,
  useCancelPaymentSession,
  usePaymentSessionPages,
  usePrefetchPaymentSession,
  useStatsSummary,
} from '@/hooks/api'
import { EMPTY_STATES } from '@/lib/empty-states'

/**
 * Tone mapping for the seven canonical session statuses. Kept on the
 * page rather than the StatusPill so the dashboard's other surfaces
 * (transactions, subscriptions) can tone-map their own enums without
 * cross-contamination.
 */
const STATUS_TONE: Record<PaymentSessionStatus, StatusTone> = {
  confirmed: 'positive',
  created: 'info',
  awaiting_payment: 'info',
  submitted: 'info',
  failed: 'danger',
  expired: 'warning',
  cancelled: 'neutral',
}

const STATUSES: readonly PaymentSessionStatus[] = [
  'created',
  'awaiting_payment',
  'submitted',
  'confirmed',
  'failed',
  'expired',
  'cancelled',
]
const STATUS_OPTIONS = filterOptions(STATUSES, STATUS_TONE)
const FILTERS = { status: multiFilter(STATUSES), date: dateFilter() }

/**
 * Pre-computed view-model. What the page actually renders. Lives
 * outside React state so the `usePaymentSessions` `select` projection
 * returns the same shape every page.
 */
interface PaymentSessionsView {
  rows: PaymentSession[]
  hasMore: boolean
}

function project(loaded: LoadedRows<PaymentSession>): PaymentSessionsView {
  return { rows: loaded.rows, hasMore: loaded.hasMore }
}

export default function PaymentSessionsPage() {
  return (
    <React.Suspense>
      <PaymentSessions />
    </React.Suspense>
  )
}

function PaymentSessions() {
  const filters = useTableFilters(FILTERS)
  const searchParams = useSearchParams()
  const { status, date } = filters.state
  const { range, error: dateError } = useDateRange(date)

  // Query params object is memoised so the TanStack Query key stays
  // referentially stable. Otherwise every parent re-render bumps the
  // key and refetches.
  const queryParams = React.useMemo(
    () => ({
      status: status.length > 0 ? status : undefined,
      from: range.from,
      to: range.to,
      limit: 100,
    }),
    [status, range.from, range.to],
  )

  const sessionsQuery = usePaymentSessionPages(queryParams, {
    // `select` projects the page shape into the view-model the page
    // renders. The reference is stable across re-renders as long as
    // the underlying page didn't change. Saves the JSX from
    // re-deriving stats on every parent render.
    select: project,
  })
  const { data, isLoading, isError, error, refetch } = sessionsQuery
  const summaryQuery = useStatsSummary({ select: (summary) => summary.paymentSessions })
  const [pendingConfirm, setPendingConfirm] = React.useState<PendingConfirm | null>(null)

  const prefetch = usePrefetchPaymentSession()
  const cancelMutation = useCancelPaymentSession()

  const columns = React.useMemo<ColumnDef<PaymentSession>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <Link
            href={`/app/payment-sessions/${row.original.id}`}
            className="text-brand-text font-mono text-xs hover:underline"
            // Prefetch the session detail when the row is in the user's
            // cursor. Clicking through feels instant. Hover-prefetch
            // is the cheapest UX win TanStack Query offers.
            onMouseEnter={() => void prefetch(row.original.id)}
            onFocus={() => void prefetch(row.original.id)}
          >
            {row.original.id.slice(0, 14)}…
          </Link>
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
          const { onchainTxHash } = session
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
                {onchainTxHash ? (
                  <DropdownMenuItem
                    className="-mt-2 text-xs"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(onchainTxHash)
                        .then(() => toast.success('Tx hash copied'))
                    }
                  >
                    <ExternalLink className="size-3" /> Copy tx hash
                  </DropdownMenuItem>
                ) : null}
                {cancelable ? (
                  <DropdownMenuItem
                    className="text-danger focus:text-danger -mt-2 text-xs"
                    onClick={() =>
                      setPendingConfirm({
                        copy: cancelPaymentSessionConfirm(session),
                        run: () => cancelMutation.mutate(session.id),
                      })
                    }
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
        title="Payment links"
        docsSlug="payment-sessions"
        description="One-time checkouts for a set amount. Each has its own link you can send to a customer."
        action={
          <div className="flex items-center gap-2">
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
            <NewPaymentSessionDialog />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total sessions"
          value={summaryValue(summaryQuery, (d) => paymentSessionCards(d).total)}
        />
        <Stat
          label="Confirmed"
          value={summaryValue(summaryQuery, (d) => paymentSessionCards(d).confirmed)}
        />
        <Stat
          label="In-flight"
          value={summaryValue(summaryQuery, (d) => paymentSessionCards(d).inFlight)}
        />
        <Stat
          label="Conversion"
          value={summaryValue(summaryQuery, (d) => paymentSessionCards(d).conversion)}
        />
      </div>

      {isError && !data ? (
        <ErrorBanner
          message={error?.message ?? 'Failed to load payment sessions'}
          onRetry={refetch}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          loading={isLoading}
          getRowId={(row) => row.id}
          highlightRowId={searchParams.get('highlight')}
          searchPlaceholder="Search by ID, description, customer wallet…"
          emptyTitle={
            filters.active
              ? 'No payment links match these filters'
              : EMPTY_STATES.paymentLinks.title
          }
          emptyDescription={
            filters.active
              ? 'Try another status or date range.'
              : EMPTY_STATES.paymentLinks.description
          }
          emptyAction={EMPTY_STATES.paymentLinks.action}
          serverRows={serverRowsOf(sessionsQuery)}
          onClearFilters={filters.active ? filters.clear : undefined}
          filters={
            <>
              <MultiSelectFilter
                label="Status"
                options={STATUS_OPTIONS}
                selected={status}
                onChange={(next) => filters.set('status', next)}
              />
              <DateFilter
                label="Created"
                value={date}
                error={dateError}
                onChange={(next) => filters.set('date', next)}
              />
            </>
          }
        />
      )}

      <ConfirmActionDialog pending={pendingConfirm} onClose={() => setPendingConfirm(null)} />
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
