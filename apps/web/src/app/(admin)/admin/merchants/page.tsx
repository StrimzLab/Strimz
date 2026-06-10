'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardContent, Input, Button } from '@strimz/ui'
import { Search } from 'lucide-react'

import { PageHeader } from '@/components/dashboard/page-header'
import { relativeTime } from '@/lib/format'
import type { MerchantStatus, MerchantTier } from '@/lib/admin-api'
import { useAdminMerchants } from '@/hooks/admin'

const STATUS_TINT: Record<MerchantStatus, string> = {
  active: 'border-[#02C76A]/40 bg-[#02C76A]/10 text-[#02C76A]',
  suspended: 'border-amber-400/40 bg-amber-50 text-amber-700',
  closed: 'border-rose-500/40 bg-rose-50 text-rose-700',
}

const TIER_TINT: Record<MerchantTier, string> = {
  free: 'border-border/60',
  growth: 'border-sky-400/40 bg-sky-50 text-sky-700',
  business: 'border-violet-400/40 bg-violet-50 text-violet-700',
  enterprise: 'border-[#02C76A]/40 bg-[#02C76A]/10 text-[#02C76A]',
}

const STATUS_FILTERS: ReadonlyArray<MerchantStatus | 'all'> = [
  'all',
  'active',
  'suspended',
  'closed',
]

export default function AdminMerchantsPage() {
  const [statusFilter, setStatusFilter] = React.useState<MerchantStatus | 'all'>('all')
  const [search, setSearch] = React.useState('')
  const debounced = useDebounced(search, 250)

  const params = React.useMemo(
    () => ({
      status: statusFilter === 'all' ? undefined : statusFilter,
      query: debounced || undefined,
      limit: 50,
    }),
    [statusFilter, debounced],
  )

  const { data, isLoading, isError, error, refetch } = useAdminMerchants(params)

  const rows = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchants"
        description="Every merchant on Strimz. Click through for the full record + admin actions."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search by email or business name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {STATUS_FILTERS.map((s) => (
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
              {s === 'all' ? 'All statuses' : s}
            </button>
          ))}
        </div>
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
                No merchants matched.
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
