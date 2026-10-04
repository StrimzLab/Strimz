'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, CreditCard, TrendingUp, Users, Wallet } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, Button } from '@strimz/ui'

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

/**
 * Admin overview / platform dashboard.
 *
 * Four KPI cards across the top. Total merchants, MRR, 30-day volume,
 * fees collected lifetime. Below, two charts (volume + signups) and a
 * top-merchants table. This is the page investors will see first; the
 * read paths feed straight from `/v1/admin/*` without any BFF hop.
 */
export default function AdminOverviewPage() {
  const [mode, setMode] = React.useState<Mode>('live')
  const [topCurrency, setTopCurrency] = React.useState<PaymentCurrency>('USDC')
  const overviewQuery = useAdminOverview(mode)
  const volumeQuery = useAdminVolume({ mode })
  const signupsQuery = useAdminSignups({})
  const topQuery = useAdminTopMerchants({ currency: topCurrency, mode, limit: 8 })

  const overview = overviewQuery.data

  const volumeChart = React.useMemo(
    () => pivotVolumeByCurrency(volumeQuery.data?.data ?? []),
    [volumeQuery.data],
  )
  const signupChart = (signupsQuery.data?.data ?? []).map((p) => ({
    day: p.day.slice(5),
    count: p.count,
  }))

  const unavailable = overviewQuery.isError ? 'Unavailable' : '—'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Strimz across every merchant. Volume, fees, signups, top performers, MRR."
        action={
          <SegmentedToggle label="Mode" options={MODE_OPTIONS} value={mode} onChange={setMode} />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Merchants"
          value={overview ? overview.merchants.total.toLocaleString() : unavailable}
          loading={overviewQuery.isLoading}
          subtle={overview ? `${overview.merchants.last30dSignups} in last 30d` : undefined}
          icon={Users}
        />
        <Kpi
          label="MRR"
          value={overview ? formatCurrencyAmounts(overview.subscriptions.mrr) : unavailable}
          loading={overviewQuery.isLoading}
          subtle={overview ? `${overview.subscriptions.active} active subs` : undefined}
          icon={TrendingUp}
        />
        <Kpi
          label="30-day volume"
          value={overview ? formatCurrencyAmounts(overview.volume.last30d) : unavailable}
          loading={overviewQuery.isLoading}
          subtle={overview ? `${overview.volume.confirmedSessions} confirmed lifetime` : undefined}
          icon={CreditCard}
        />
        <Kpi
          label="Fees collected (lifetime)"
          value={overview ? formatCurrencyAmounts(overview.volume.lifetimeFees) : unavailable}
          loading={overviewQuery.isLoading}
          subtle={
            overview ? `gross: ${formatCurrencyAmounts(overview.volume.lifetime)}` : undefined
          }
          icon={Wallet}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardContent className="p-6">
            <h3 className="font-sora text-base font-semibold">Volume (90d)</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Confirmed transactions per day, one line per currency, {mode} mode.
            </p>
            <div className="mt-4 h-[260px]">
              {volumeQuery.isError ? (
                <EmptyChart label={`Could not load volume: ${volumeQuery.error.message}`} />
              ) : volumeQuery.isLoading ? (
                <div className="bg-muted/30 h-full animate-pulse rounded-md" />
              ) : volumeChart.points.length === 0 ? (
                <EmptyChart label="No volume yet." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volumeChart.points}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    {volumeChart.currencies.map((currency) => (
                      <Line
                        key={currency}
                        type="monotone"
                        dataKey={currency}
                        name={`Volume (${currency})`}
                        stroke={CURRENCY_STROKE[currency]}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="p-6">
            <h3 className="font-sora text-base font-semibold">New merchants (90d)</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Signups per day. Includes test-mode accounts.
            </p>
            <div className="mt-4 h-[260px]">
              {signupChart.length === 0 ? (
                <EmptyChart label="No signups in the last 90 days." />
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
      </div>

      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-sora text-base font-semibold">Top merchants</h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Ranked by lifetime confirmed-transaction volume in {topCurrency}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SegmentedToggle
                label="Currency"
                options={CURRENCY_OPTIONS}
                value={topCurrency}
                onChange={setTopCurrency}
              />
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/merchants">
                  View all <ArrowUpRight className="ml-1 size-3" />
                </Link>
              </Button>
            </div>
          </div>
          {topQuery.isError ? (
            <p className="text-destructive py-6 text-center text-xs">
              Could not load top merchants: {topQuery.error.message}
            </p>
          ) : topQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="border-border/60 bg-muted/30 h-12 animate-pulse rounded-lg border"
                />
              ))}
            </div>
          ) : !topQuery.data || topQuery.data.data.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-xs">No transactions yet.</p>
          ) : (
            <div className="space-y-1.5">
              {topQuery.data.data.map((m, idx) => (
                <Link
                  key={m.merchantId}
                  href={`/admin/merchants/${m.merchantId}`}
                  className="border-border/60 flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors hover:border-[#02C76A]/40"
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
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

const CURRENCY_STROKE: Record<PaymentCurrency, string> = { USDC: '#02C76A', EURC: '#2563EB' }

function Kpi({
  label,
  value,
  loading,
  subtle,
  icon: Icon,
}: {
  label: string
  value: string
  loading: boolean
  subtle?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-muted-foreground text-xs">{label}</div>
          {Icon ? <Icon className="text-muted-foreground/50 size-4" /> : null}
        </div>
        {loading ? (
          <div className="bg-muted/60 mt-2 h-7 w-3/4 animate-pulse rounded" />
        ) : (
          <div className="font-sora mt-1 text-2xl font-semibold">{value}</div>
        )}
        {subtle ? <div className="text-muted-foreground mt-1 text-xs">{subtle}</div> : null}
      </CardContent>
    </Card>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
      {label}
    </div>
  )
}
