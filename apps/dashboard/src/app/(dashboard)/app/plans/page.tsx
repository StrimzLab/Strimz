'use client'

import * as React from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@strimz/ui'
import type { SubscriptionPlan, SubscriptionPlanStatus } from '@strimz/shared-types'

import { PageHeader } from '@strimz/web-shared/components/dashboard/page-header'
import { DataTable, StatusPill } from '@strimz/web-shared/components/dashboard/data-table'
import {
  MultiSelectFilter,
  filterOptions,
  useTableFilters,
} from '@strimz/web-shared/components/dashboard/filter-bar'
import { NewPlanDialog } from '@/components/dashboard/plans/new-plan-dialog'
import { TokenLogo } from '@strimz/web-shared/components/shared/token-logo'
import { relativeTime } from '@strimz/web-shared/lib/format'
import type { LoadedRows } from '@strimz/web-shared/lib/cursor-pages'
import { planPriceLabel } from '@/lib/plans-view'
import { serverRowsOf, useSubscriptionPlanPages } from '@/hooks/api'
import { EMPTY_STATES } from '@/lib/empty-states'
import { multiFilter } from '@strimz/web-shared/lib/table-filters'

const STATUSES: readonly SubscriptionPlanStatus[] = ['active', 'archived']
const STATUS_OPTIONS = filterOptions(STATUSES, { active: 'positive', archived: 'neutral' })
const FILTERS = { status: multiFilter(STATUSES, ['active']) }

interface PlansView {
  rows: SubscriptionPlan[]
  hasMore: boolean
}

function project(loaded: LoadedRows<SubscriptionPlan>): PlansView {
  return { rows: loaded.rows, hasMore: loaded.hasMore }
}

export default function PlansPage() {
  return (
    <React.Suspense>
      <Plans />
    </React.Suspense>
  )
}

function Plans() {
  const filters = useTableFilters(FILTERS)
  const { status } = filters.state
  const params = React.useMemo(
    () => ({ status: status.length > 0 ? status : undefined, limit: 100 }),
    [status],
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
          emptyTitle={filters.active ? 'No plans match these filters' : EMPTY_STATES.plans.title}
          emptyDescription={filters.active ? 'Try another status.' : EMPTY_STATES.plans.description}
          emptyAction={EMPTY_STATES.plans.action}
          serverRows={serverRowsOf(plansQuery)}
          onClearFilters={filters.active ? filters.clear : undefined}
          filters={
            <MultiSelectFilter
              label="Status"
              options={STATUS_OPTIONS}
              selected={status}
              initial={FILTERS.status.initial}
              onChange={(next) => filters.set('status', next)}
            />
          }
        />
      )}
    </div>
  )
}
