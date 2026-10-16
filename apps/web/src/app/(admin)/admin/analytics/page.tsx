'use client'

import * as React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent } from '@strimz/ui'

import { PageHeader } from '@/components/dashboard/page-header'
import type { Mode, PaymentCurrency } from '@strimz/shared-types'
import { SegmentedToggle } from '@/components/shared/segmented-toggle'
import { formatTokenAmount } from '@/lib/format'
import { formatCurrencyAmounts } from '@/lib/currency-totals'
import { CURRENCY_OPTIONS, MODE_OPTIONS, pivotVolumeByCurrency } from '@/lib/admin-volume'
import {
  useAdminOverview,
  useAdminSignups,
  useAdminTopMerchants,
  useAdminVolume,
} from '@/hooks/admin'

export default function AdminAnalyticsPage() {
  const [mode, setMode] = React.useState<Mode>('live')
  const [topCurrency, setTopCurrency] = React.useState<PaymentCurrency>('USDC')
  const overviewQuery = useAdminOverview(mode)
  const volumeQuery = useAdminVolume({ mode })
  const signupsQuery = useAdminSignups({})
  const topQuery = useAdminTopMerchants({ currency: topCurrency, mode, limit: 15 })

  const overview = overviewQuery.data
  const unavailable = overviewQuery.isError ? 'Unavailable' : '—'
  const volumeChart = React.useMemo(
    () => pivotVolumeByCurrency(volumeQuery.data?.data ?? []),
    [volumeQuery.data],
  )
  const signupChart = (signupsQuery.data?.data ?? []).map((p) => ({
    day: p.day.slice(5),
    count: p.count,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Volume + signups across the platform. Bare numbers, no projections. This is what already happened."
        action={
          <SegmentedToggle label="Mode" options={MODE_OPTIONS} value={mode} onChange={setMode} />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Lifetime gross volume"
          value={overview ? formatCurrencyAmounts(overview.volume.lifetime) : unavailable}
        />
        <Stat
          label="Lifetime fees"
          value={overview ? formatCurrencyAmounts(overview.volume.lifetimeFees) : unavailable}
        />
        <Stat
          label="30-day volume"
          value={overview ? formatCurrencyAmounts(overview.volume.last30d) : unavailable}
        />
        <Stat
          label="Active subs"
          value={overview ? overview.subscriptions.active.toLocaleString() : unavailable}
        />
      </div>

      <Card className="border-border/60">
        <CardContent className="p-6">
          <h3 className="font-sora text-base font-semibold">Volume + fees (90d)</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Daily confirmed transaction volume per currency, {mode} mode, with Strimz's cut shaded
            underneath.
          </p>
          <div className="mt-4 h-[320px]">
            {volumeQuery.isError ? (
              <Empty label={`Could not load volume: ${volumeQuery.error.message}`} />
            ) : volumeQuery.isLoading ? (
              <div className="bg-muted/30 h-full animate-pulse rounded-md" />
            ) : volumeChart.points.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeChart.points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  {volumeChart.currencies.flatMap((currency) => [
                    <Area
                      key={currency}
                      type="monotone"
                      dataKey={currency}
                      name={`Volume (${currency})`}
                      stroke={CURRENCY_STROKE[currency].volume}
                      fill={CURRENCY_STROKE[currency].volume}
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />,
                    <Area
                      key={`${currency}_fees`}
                      type="monotone"
                      dataKey={`${currency}_fees`}
                      name={`Fees (${currency})`}
                      stroke={CURRENCY_STROKE[currency].fees}
                      fill={CURRENCY_STROKE[currency].fees}
                      fillOpacity={0.3}
                    />,
                  ])}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-6">
          <h3 className="font-sora text-base font-semibold">Signups (90d)</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            New merchant rows per day. Test-mode included.
          </p>
          <div className="mt-4 h-[260px]">
            {signupChart.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={signupChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Signups" fill="#02C76A" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-sora text-base font-semibold">
              Top merchants by volume in {topCurrency}
            </h3>
            <SegmentedToggle
              label="Currency"
              options={CURRENCY_OPTIONS}
              value={topCurrency}
              onChange={setTopCurrency}
            />
          </div>
          {topQuery.isError ? (
            <p className="text-destructive mt-4 text-xs">
              Could not load top merchants: {topQuery.error.message}
            </p>
          ) : topQuery.isLoading ? (
            <div className="mt-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="border-border/60 bg-muted/30 h-12 animate-pulse rounded-lg border"
                />
              ))}
            </div>
          ) : topQuery.data && topQuery.data.data.length > 0 ? (
            <div className="mt-4 space-y-2">
              {topQuery.data.data.map((m, idx) => (
                <div
                  key={m.merchantId}
                  className="border-border/60 flex items-center justify-between rounded-lg border px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground w-6 font-mono text-xs">#{idx + 1}</span>
                    <div className="text-sm">
                      <div className="font-medium">{m.businessName ?? m.email}</div>
                      <div className="text-muted-foreground text-xs">{m.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-medium">
                      {formatTokenAmount(m.volume, topQuery.data.currency)}
                    </div>
                    <div className="text-muted-foreground text-xs">{m.transactionCount} tx</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/60 rounded-xl border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-sora mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}

function Empty({ label = 'No data in the selected window.' }: { label?: string }) {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
      {label}
    </div>
  )
}

const CURRENCY_STROKE: Record<PaymentCurrency, { volume: string; fees: string }> = {
  USDC: { volume: '#02C76A', fees: '#0c7a3e' },
  EURC: { volume: '#2563EB', fees: '#1e3a8a' },
}
