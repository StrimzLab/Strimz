'use client'

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@strimz/ui'
import type { SubscriptionPlan } from '@strimz/shared-types'

import { PageHeader } from '@/components/dashboard/page-header'
import { DataTable, StatusPill } from '@/components/dashboard/data-table'
import { NewPlanDialog } from '@/components/dashboard/plans/new-plan-dialog'
import { TokenLogo } from '@/components/shared/token-logo'
import { relativeTime } from '@/lib/format'
import type { LoadedRows } from '@/lib/cursor-pages'
import { planPriceLabel } from '@/lib/plans-view'
import { serverRowsOf, useSubscriptionPlanPages } from '@/hooks/api'
import { EMPTY_STATES } from '@/lib/empty-states'

const FILTERS = ['active', 'archived', 'all'] as const
type Filter = (typeof FILTERS)[number]

interface PlansView {
  rows: SubscriptionPlan[]
  hasMore: boolean
}

function project(loaded: LoadedRows<SubscriptionPlan>): PlansView {
  return { rows: loaded.rows, hasMore: loaded.hasMore }
}

export default function PlansPage() {
  const [filter, setFilter] = React.useState<Filter>('active')
  const params = React.useMemo(
    () => ({ status: filter === 'all' ? undefined : filter, limit: 100 }),
    [filter],
  )
  const plansQuery = useSubscriptionPlanPages(params, { select: project })
  const { data, isLoading, isError, error, refetch } = plansQuery

  const columns = React.useMemo<ColumnDef<SubscriptionPlan>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Plan',
        cell: ({ row }) => (
          <Link
            href={`/app/plans/${row.original.id}`}
            className="text-accent font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: 'amount',
        header: 'Price',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-mono">
            <TokenLogo symbol={row.original.currency} size={14} />
            {planPriceLabel(row.original)}
          </span>
        ),
      },
      {
        accessorKey: 'trialPeriodDays',
        header: 'Trial',
        cell: ({ row }) =>
          row.original.trialPeriodDays ? `${row.original.trialPeriodDays} days` : 'None',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusPill tone={row.original.status === 'active' ? 'positive' : 'neutral'}>
            {row.original.status}
          </StatusPill>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {relativeTime(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        docsSlug="plans"
        description="Recurring prices your customers subscribe to. Each plan has its own sign-up link."
        action={<NewPlanDialog />}
      />

      {isError && !data ? (
        <div className="border-border/60 bg-background flex items-center justify-between rounded-xl border p-4">
          <div>
            <div className="text-sm font-medium">Couldn’t load plans</div>
            <div className="text-muted-foreground text-xs">
              {error?.message ?? 'Failed to load plans'}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          loading={isLoading}
          searchPlaceholder="Search plans…"
          emptyTitle={filter === 'archived' ? 'No archived plans' : EMPTY_STATES.plans.title}
          emptyDescription={EMPTY_STATES.plans.description}
          emptyAction={filter === 'archived' ? undefined : EMPTY_STATES.plans.action}
          serverRows={serverRowsOf(plansQuery)}
          toolbar={
            <div className="flex flex-wrap items-center gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={[
                    'h-8 rounded-md border px-2.5 text-xs font-medium capitalize transition-colors',
                    filter === f
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border/60 hover:bg-muted',
                  ].join(' ')}
                >
                  {f}
                </button>
              ))}
            </div>
          }
        />
      )}
    </div>
  )
}
