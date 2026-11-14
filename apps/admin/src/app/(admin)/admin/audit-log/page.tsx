'use client'

import * as React from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { Button, Card, CardContent } from '@strimz/ui'
import { arcExplorerTxUrl } from '@strimz/shared-config'

import { PageHeader } from '@strimz/web-shared/components/dashboard/page-header'
import { StatusPill } from '@strimz/web-shared/components/dashboard/data-table'
import {
  DateFilter,
  MultiSelectFilter,
  filterOptions,
  useDateRange,
  useTableFilters,
} from '@strimz/web-shared/components/dashboard/filter-bar'
import { dateFilter, multiFilter } from '@strimz/web-shared/lib/table-filters'
import { relativeTime, shortAddress } from '@strimz/web-shared/lib/format'
import { env } from '@strimz/web-shared/lib/env'
import { ForbiddenError } from '@strimz/web-shared/lib/merchant-api/errors'
import type { AuditCategory, AuditLogEntry } from '@strimz/web-shared/lib/admin-api'
import { useAdminAuditLog } from '@/hooks/admin'

const CATEGORIES: readonly AuditCategory[] = [
  'admin',
  'merchant',
  'agent',
  'api_key',
  'webhook',
  'payment',
  'subscription',
  'refund',
  'compliance',
  'auth',
  'member',
  'settings',
]
const SOURCES = ['onchain', 'admin_action'] as const
type Source = (typeof SOURCES)[number]

const CATEGORY_OPTIONS = filterOptions(CATEGORIES, undefined, (c) => c.replace('_', ' '))
const SOURCE_OPTIONS = filterOptions(SOURCES, undefined, (s) =>
  s === 'onchain' ? 'On-chain' : 'Admin action',
)
const FILTERS = {
  category: multiFilter(CATEGORIES),
  source: multiFilter(SOURCES),
  date: dateFilter(),
}

export default function AdminAuditLogPage() {
  return (
    <React.Suspense>
      <AuditLog />
    </React.Suspense>
  )
}

function AuditLog() {
  const filters = useTableFilters(FILTERS)
  const { category, source, date } = filters.state
  const { range, error: dateError } = useDateRange(date)

  const params = React.useMemo(
    () => ({
      category: category.length > 0 ? category : undefined,
      // Both or neither selected means no source filter.
      onchain: source.length === 1 ? (source[0] as Source) === 'onchain' : undefined,
      from: range.from,
      to: range.to,
      limit: 50,
    }),
    [category, source, range.from, range.to],
  )
  const query = useAdminAuditLog(params)
  const rows = query.data?.pages.flatMap((p) => p.data) ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every recorded admin action and on-chain admin event, newest first."
      />

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFilter
          label="Category"
          options={CATEGORY_OPTIONS}
          selected={category}
          onChange={(next) => filters.set('category', next)}
        />
        <MultiSelectFilter
          label="Source"
          options={SOURCE_OPTIONS}
          selected={source}
          onChange={(next) => filters.set('source', next)}
        />
        <DateFilter
          label="Date"
          value={date}
          error={dateError}
          onChange={(next) => filters.set('date', next)}
        />
        {filters.active ? (
          <Button variant="ghost" size="sm" className="h-9 px-2.5 text-xs" onClick={filters.clear}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          {query.isPending ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-muted/60 h-10 animate-pulse rounded" />
              ))}
            </div>
          ) : query.error instanceof ForbiddenError ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              Only super admins and admins can see the audit log.
            </p>
          ) : query.isError && rows.length === 0 ? (
            <div className="flex items-center justify-between gap-2 p-4 text-sm">
              <span className="text-danger">Couldn&apos;t load the audit log.</span>
              <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                Try again
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              {filters.active ? 'Nothing recorded for these filters.' : 'Nothing recorded yet.'}
            </p>
          ) : (
            <ul className="divide-border/60 divide-y">
              {rows.map((row) => (
                <AuditRow key={row.id} row={row} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
      {query.isFetchNextPageError ? (
        <p className="text-danger text-center text-xs">Couldn&apos;t load more. Try again.</p>
      ) : null}
    </div>
  )
}

function AuditRow({ row }: { row: AuditLogEntry }) {
  const [open, setOpen] = React.useState(false)
  const m = row.metadata
  const txHash = typeof m.transactionHash === 'string' ? m.transactionHash : null
  const contractName = typeof m.contractName === 'string' ? m.contractName : null
  const roleName = typeof m.roleName === 'string' ? m.roleName : null
  const account = typeof m.account === 'string' ? m.account : null
  const who = row.actorEmail ?? (account ? shortAddress(account) : null)

  return (
    <li className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="hover:bg-muted/40 flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left"
      >
        <span className="text-muted-foreground w-28 shrink-0 text-xs">
          {relativeTime(row.createdAt)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-medium">{row.action}</span>
          <span className="text-muted-foreground block truncate text-xs">
            {contractName ?? row.targetType}
            {roleName ? ` · ${roleName}` : ''} · {shortTarget(row.targetId)}
            {who ? ` · by ${who}` : ''}
          </span>
        </span>
        {row.alert ? (
          <StatusPill tone={row.alert.alertedAt ? 'neutral' : 'warning'}>
            {row.alert.alertedAt
              ? `Alert emailed ${relativeTime(row.alert.alertedAt)}`
              : 'Alert pending'}
          </StatusPill>
        ) : null}
        {row.onchain ? <StatusPill tone="info">On-chain</StatusPill> : null}
        <ChevronDown
          className={`text-muted-foreground size-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div className="space-y-2 px-4 pb-4">
          {txHash ? (
            <a
              href={arcExplorerTxUrl(env.arcEnvironment, txHash)}
              target="_blank"
              rel="noreferrer"
              className="text-brand-text inline-flex items-center gap-1 text-xs hover:underline"
            >
              View transaction <ExternalLink className="size-3" />
            </a>
          ) : null}
          {row.ipAddress ? (
            <p className="text-muted-foreground text-xs">From {row.ipAddress}</p>
          ) : null}
          <pre className="bg-muted/50 overflow-x-auto rounded-md p-3 text-xs">
            {JSON.stringify(row.metadata, null, 2)}
          </pre>
        </div>
      ) : null}
    </li>
  )
}

function shortTarget(id: string): string {
  return /^0x[0-9a-fA-F]{40}$/u.test(id) ? shortAddress(id) : id
}
