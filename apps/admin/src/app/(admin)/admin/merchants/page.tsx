'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardContent, Input, Button } from '@strimz/ui'
import { Search } from 'lucide-react'

import { PageHeader } from '@strimz/web-shared/components/dashboard/page-header'
import {
  MultiSelectFilter,
  filterOptions,
  useTableFilters,
} from '@strimz/web-shared/components/dashboard/filter-bar'
import { multiFilter } from '@strimz/web-shared/lib/table-filters'
import { relativeTime } from '@strimz/web-shared/lib/format'
import type { MerchantStatus, MerchantTier } from '@strimz/web-shared/lib/admin-api'
import { useAdminMerchants } from '@/hooks/admin'

const STATUS_TINT: Record<MerchantStatus, string> = {
  active: 'border-accent/40 bg-accent/10 text-brand-text',
  suspended: 'border-warning-border bg-warning-surface text-warning',
  closed: 'border-danger-border bg-danger-surface text-danger',
}

const TIER_TINT: Record<MerchantTier, string> = {
  free: 'border-border/60',
  starter: 'border-sky-400/40 bg-sky-50 text-sky-700',
  growth: 'border-violet-400/40 bg-violet-50 text-violet-700',
  enterprise: 'border-accent/40 bg-accent/10 text-brand-text',
}

const STATUSES: readonly MerchantStatus[] = ['active', 'suspended', 'closed']
const TIERS: readonly MerchantTier[] = ['free', 'starter', 'growth', 'enterprise']
const STATUS_OPTIONS = filterOptions(STATUSES, {
  active: 'positive',
  suspended: 'warning',
  closed: 'danger',
})
const TIER_OPTIONS = filterOptions(TIERS)
const FILTERS = { status: multiFilter(STATUSES), tier: multiFilter(TIERS) }

export default function AdminMerchantsPage() {
  return (
    <React.Suspense>
      <AdminMerchants />
    </React.Suspense>
  )
}

function AdminMerchants() {
  const filters = useTableFilters(FILTERS)
  const { status, tier } = filters.state
  const [search, setSearch] = React.useState('')
  const debounced = useDebounced(search, 250)
  const narrowed = filters.active || debounced !== ''

  const params = React.useMemo(
    () => ({
      status: status.length > 0 ? status : undefined,
      tier: tier.length > 0 ? tier : undefined,
      query: debounced || undefined,
      limit: 50,
    }),
    [status, tier, debounced],
  )

  const { data, isLoading, isError, error, refetch } = useAdminMerchants(params)

  const rows = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchants"
        description="Every merchant on Strimz. Click through for the full record + admin actions."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search by email or business name…"
            aria-label="Search by email or business name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <MultiSelectFilter
          label="Status"
          options={STATUS_OPTIONS}
          selected={status}
          onChange={(next) => filters.set('status', next)}
        />
        <MultiSelectFilter
          label="Tier"
          options={TIER_OPTIONS}
          selected={tier}
          onChange={(next) => filters.set('tier', next)}
        />
        {narrowed ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2.5 text-xs"
            onClick={() => {
              setSearch('')
              filters.clear()
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {isError ? (
        <Card className="border-border/60">
          <CardContent className="flex items-center justify-between p-4">
            <div className="text-xs">
              <div className="font-medium">Couldn’t load merchants</div>
              <div className="text-muted-foreground">{error?.message ?? 'unknown error'}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardContent className="p-0">
            <div className="text-muted-foreground border-border/60 grid grid-cols-12 gap-2 border-b px-4 py-2 text-[11px] uppercase tracking-wide">
              <div className="col-span-4">Business / email</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Tier</div>
              <div className="col-span-2">Country</div>
              <div className="col-span-2 text-right">Created</div>
            </div>
            {isLoading ? (
              <div className="p-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-muted/30 mb-2 h-12 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="text-muted-foreground py-12 text-center text-xs">
                {narrowed ? 'No merchants match these filters.' : 'No merchants yet.'}
              </div>
            ) : (
              <div className="divide-y">
                {rows.map((m) => (
                  <Link
                    key={m.id}
                    href={`/admin/merchants/${m.id}`}
                    className="hover:bg-muted/30 grid grid-cols-12 items-center gap-2 px-4 py-3 transition-colors"
                  >
                    <div className="col-span-4">
                      <div className="text-sm font-medium">
                        {m.businessName ?? 'Unnamed merchant'}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">{m.email}</div>
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-[10px] capitalize ${STATUS_TINT[m.status]}`}
                      >
                        {m.status}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-[10px] capitalize ${TIER_TINT[m.tier]}`}
                      >
                        {m.tier}
                      </span>
                    </div>
                    <div className="col-span-2 text-xs">{m.countryCode ?? '—'}</div>
                    <div className="text-muted-foreground col-span-2 text-right text-xs">
                      {relativeTime(m.createdAt)}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
