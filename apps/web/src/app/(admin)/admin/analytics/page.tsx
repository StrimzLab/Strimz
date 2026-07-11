'use client'

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
import { formatTokenAmount } from '@/lib/format'
import {
  useAdminOverview,
  useAdminSignups,
  useAdminTopMerchants,
  useAdminVolume,
} from '@/hooks/admin'

export default function AdminAnalyticsPage() {
  const overviewQuery = useAdminOverview()
  const volumeQuery = useAdminVolume({})
  const signupsQuery = useAdminSignups({})
  const topQuery = useAdminTopMerchants(15)

  const overview = overviewQuery.data
  const volumeChart = (volumeQuery.data?.data ?? []).map((p) => ({
    day: p.day.slice(5),
    volume: Number(BigInt(p.volume) / 1_000_000n),
    fees: Number(BigInt(p.fees) / 1_000_000n),
  }))
  const signupChart = (signupsQuery.data?.data ?? []).map((p) => ({
    day: p.day.slice(5),
    count: p.count,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Volume + signups across the platform. Bare numbers, no projections. This is what already happened."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Lifetime gross volume"
          value={overview ? formatTokenAmount(overview.volume.lifetimeUsdc, 'USDC') : '—'}
        />
        <Stat
          label="Lifetime fees"
          value={overview ? formatTokenAmount(overview.volume.lifetimeFeesUsdc, 'USDC') : '—'}
        />
        <Stat
          label="30-day volume"
          value={overview ? formatTokenAmount(overview.volume.last30dUsdc, 'USDC') : '—'}
        />
        <Stat
          label="Active subs"
          value={overview ? overview.subscriptions.active.toLocaleString() : '—'}
        />
      </div>

      <Card className="border-border/60">
        <CardContent className="p-6">
          <h3 className="font-sora text-base font-semibold">Volume + fees (90d)</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Daily confirmed transaction volume with Strimz's cut shaded underneath.
          </p>
          <div className="mt-4 h-[320px]">
            {volumeChart.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    name="Volume (USDC)"
                    stroke="#02C76A"
                    fill="#02C76A"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="fees"
                    name="Fees (USDC)"
                    stroke="#0c7a3e"
                    fill="#0c7a3e"
                    fillOpacity={0.3}
                  />
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
          <h3 className="font-sora text-base font-semibold">Top merchants by volume</h3>
          {topQuery.isLoading ? (
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
                      {formatTokenAmount(m.volumeUsdc, 'USDC')}
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

function Empty() {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
      No data in the selected window.
    </div>
  )
}
