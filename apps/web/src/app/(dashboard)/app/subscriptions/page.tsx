'use client'

import * as React from 'react'
import { Download, MoreHorizontal, Ban } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@strimz/ui'
import type { Subscription, SubscriptionStatus } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { TokenLogo } from '@/components/shared/token-logo'
import { downloadCsv } from '@/lib/csv-export'
import { formatTokenAmount, relativeTime, shortAddress } from '@/lib/format'
import { useCancelSubscription, useSubscriptions } from '@/hooks/api'

const STATUS_TONE: Record<
  SubscriptionStatus,
  'positive' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  active: 'positive',
  trialing: 'info',
  at_risk: 'warning',
  paused: 'neutral',
  cancelled: 'neutral',
  lapsed: 'danger',
}

const FILTERS: ReadonlyArray<SubscriptionStatus | 'all'> = [
  'all',
  'active',
  'trialing',
  'at_risk',
  'paused',
  'cancelled',
  'lapsed',
]

/**
 * View-model returned by the `select` projection. Pre-computing the
 * status-bucket counts here means the page's stat cards render from
 * memoised data. The per-row mapping happens once per query result.
 */
interface SubscriptionsView {
  rows: Subscription[]
  counts: Record<SubscriptionStatus, number>
}

const EMPTY_COUNTS: Record<SubscriptionStatus, number> = {
  active: 0,
  trialing: 0,
  at_risk: 0,
  paused: 0,
  cancelled: 0,
  lapsed: 0,
}

function projectSubscriptions(page: { data: Subscription[] }): SubscriptionsView {
  const counts = { ...EMPTY_COUNTS }
  for (const row of page.data) counts[row.status] = (counts[row.status] ?? 0) + 1
  return { rows: page.data, counts }
}

export default function SubscriptionsPage() {
  const [statusFilter, setStatusFilter] = React.useState<SubscriptionStatus | 'all'>('all')

  const subscriptionsParams = React.useMemo(
    () => ({ status: statusFilter === 'all' ? undefined : statusFilter, limit: 100 }),
    [statusFilter],
  )
  const { data, isLoading, isError, error, refetch } = useSubscriptions(subscriptionsParams, {
    select: projectSubscriptions,
  })

  const cancelMutation = useCancelSubscription()

  const columns = React.useMemo<ColumnDef<Subscription>[]>(
    () => [
      {
        accessorKey: 'payerAddress',
        header: 'Subscriber',
        cell: ({ row }) => (
          <div className="flex flex-col leading-tight">
            <code className="text-xs">{shortAddress(row.original.payerAddress)}</code>
            <span className="text-muted-foreground text-[11px]">{row.original.customerId}</span>
          </div>
        ),
      },
      {
        accessorKey: 'planId',
        header: 'Plan',
        cell: ({ row }) => (
          <code className="text-muted-foreground text-xs">{row.original.planId.slice(0, 14)}…</code>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Amount',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-mono">
            <TokenLogo symbol={row.original.currency} size={14} />
            {formatTokenAmount(row.original.amount, row.original.currency)}
            <span className="text-muted-foreground text-xs">/{intervalShort(row.original)}</span>
          </span>
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
        accessorKey: 'currentPeriodEndAt',
        header: 'Period ends',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {relativeTime(row.original.currentPeriodEndAt)}
          </span>
        ),
      },
      {
        accessorKey: 'nextChargeAt',
        header: 'Next charge',
        cell: ({ row }) =>
          row.original.status === 'cancelled' || row.original.status === 'lapsed' ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span>
              {row.original.nextChargeAt ? relativeTime(row.original.nextChargeAt) : 'pending'}
            </span>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const sub = row.original
          const cancellable =
            sub.status === 'active' || sub.status === 'trialing' || sub.status === 'at_risk'
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
                  onClick={() =>
                    navigator.clipboard
                      .writeText(sub.id)
                      .then(() => toast.success('Subscription ID copied'))
                  }
                >
                  Copy ID
                </DropdownMenuItem>
                {cancellable ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-rose-600 focus:text-rose-600"
                      onClick={() => cancelMutation.mutate({ id: sub.id })}
                      disabled={cancelMutation.isPending}
                    >
                      <Ban className="mr-2 size-4" /> Cancel at period end
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [cancelMutation],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        docsSlug="subscriptions"
        description="Every customer signed up to a recurring plan. Each row tracks one subscription."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data || data.rows.length === 0}
              onClick={() => {
                if (!data) return
                downloadCsv('subscriptions.csv', data.rows, [
                  { key: 'id', header: 'ID' },
                  { key: 'planId', header: 'Plan' },
                  { key: 'payerAddress', header: 'Subscriber wallet' },
                  { key: 'amount', header: 'Amount (raw)' },
                  { key: 'currency', header: 'Currency' },
                  { key: 'interval', header: 'Interval' },
                  { key: 'status', header: 'Status' },
                  { key: 'currentPeriodEndAt', header: 'Period ends' },
                  { key: 'nextChargeAt', header: 'Next charge' },
                  { key: 'createdAt', header: 'Created' },
                ])
                toast.success('Exported subscriptions.csv')
              }}
            >
              <Download className="mr-1.5 size-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(['active', 'at_risk', 'trialing', 'lapsed'] as const).map((s) => (
          <div
            key={s}
            className="shadow-sub-card border-border/60 bg-background rounded-xl border p-4"
          >
            <div className="text-muted-foreground text-xs capitalize">{s.replace(/_/g, ' ')}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-sora text-2xl font-semibold">
                {data ? data.counts[s] : '—'}
              </span>
              <span className="text-muted-foreground text-xs">subscriptions</span>
            </div>
          </div>
        ))}
      </div>

      {isError ? (
        <ErrorBanner message={error?.message ?? 'Failed to load subscriptions'} onRetry={refetch} />
      ) : (
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          loading={isLoading}
          searchPlaceholder="Search by subscriber wallet, plan…"
          emptyTitle="No subscriptions"
          emptyDescription="Send customers your hosted plan URL to start subscribing."
          toolbar={
            <div className="flex flex-wrap items-center gap-1">
              {FILTERS.map((s) => (
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

function intervalShort(sub: Subscription): string {
  // "monthly" → "month", "weekly" → "week", etc. Adds the count when > 1.
  const base = sub.interval.replace(/ly$/, '')
  return sub.intervalCount > 1 ? `${sub.intervalCount} ${base}s` : base
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border-border/60 bg-background flex items-center justify-between rounded-xl border p-4">
      <div>
        <div className="text-sm font-medium">Couldn’t load subscriptions</div>
        <div className="text-muted-foreground text-xs">{message}</div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
