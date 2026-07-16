'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight, CreditCard, Receipt, Users, Wallet } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent } from '@strimz/ui'

import { PageHeader } from '@/components/dashboard/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { stagger, inViewOnce } from '@/lib/motion'
import { formatTokenAmount, tokenAmountToNumber } from '@/lib/format'
import { useDashboardTour } from '@/hooks/use-dashboard-tour'
import {
  useInvoices,
  useMerchantMe,
  useMrr,
  usePaymentSessions,
  useSubscriptions,
} from '@/hooks/api'

const STEPS = [
  {
    n: 1,
    t: 'Issue your first API key',
    d: 'Test mode is free. Live mode unlocks after MFA + email verification.',
    href: '/app/api-keys',
  },
  {
    n: 2,
    t: 'Send a test payment',
    d: 'Create a test session, complete the hosted checkout, watch it confirm.',
    href: '/app/payment-sessions',
  },
  {
    n: 3,
    t: 'Wire a webhook',
    d: 'Add an HTTPS endpoint and send a test event to verify your handler.',
    href: '/app/webhooks',
  },
] as const

export default function DashboardHome() {
  const merchantQuery = useMerchantMe()
  const mrrQuery = useMrr()
  const sessionsQuery = usePaymentSessions({ limit: 100 })
  const subsQuery = useSubscriptions({ status: 'active', limit: 100 })
  const invoicesQuery = useInvoices({ limit: 100 })

  useDashboardTour({ enabled: !!merchantQuery.data })

  const derived = React.useMemo(() => {
    const now = Date.now()
    const sevenDays = 7 * 86_400_000
    const thirtyDays = 30 * 86_400_000

    const sessions = sessionsQuery.data?.data ?? []
    const confirmed = sessions.filter((s) => s.status === 'confirmed')
    const confirmed7d = confirmed.filter((s) => now - +new Date(s.updatedAt) < sevenDays)
    const confirmed30d = confirmed.filter((s) => now - +new Date(s.updatedAt) < thirtyDays)
    const volume7d = confirmed7d.reduce((s, r) => s + tokenAmountToNumber(r.amount), 0)

    const invoices = invoicesQuery.data?.data ?? []
    const openInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue')

    // Per-day series for the volume chart. We index into a 30-slot
    // array keyed by midnight-UTC day so the chart shows a stable
    // x-axis even when a day has no confirmed transactions.
    const dayLabel = (d: Date) =>
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const buckets: { date: Date; day: string; volume: number; count: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000)
      d.setUTCHours(0, 0, 0, 0)
      buckets.push({ date: d, day: dayLabel(d), volume: 0, count: 0 })
    }
    for (const s of confirmed30d) {
      const d = new Date(s.updatedAt)
      d.setUTCHours(0, 0, 0, 0)
      const slot = buckets.find((b) => +b.date === +d)
      if (slot) {
        slot.volume += tokenAmountToNumber(s.amount)
        slot.count += 1
      }
    }
    return {
      volume7d,
      confirmedCount7d: confirmed7d.length,
      activeSubsCount: subsQuery.data?.data.length ?? 0,
      openInvoiceCount: openInvoices.length,
      anyConfirmedAtAll: confirmed.length > 0,
      series: buckets.map(({ day, volume, count }) => ({ day, volume, count })),
    }
  }, [sessionsQuery.data, subsQuery.data, invoicesQuery.data])

  const merchant = merchantQuery.data
  const showGettingStarted = !derived.anyConfirmedAtAll

  const KPIS = [
    {
      label: 'MRR',
      value: mrrQuery.data ? formatTokenAmount(mrrQuery.data.mrr, 'USDC') : '—',
      icon: Wallet,
      href: '/app/analytics',
      subtle: mrrQuery.data ? `${mrrQuery.data.activeSubscribers} active` : 'Loading…',
    },
    {
      label: 'Active subscribers',
      value: derived.activeSubsCount.toLocaleString(),
      icon: Users,
      href: '/app/subscriptions',
      subtle: 'Customers cycling',
    },
    {
      label: '7-day volume',
      value: derived.volume7d.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' USDC',
      icon: CreditCard,
      href: '/app/payment-sessions',
      subtle: `${derived.confirmedCount7d} confirmed`,
    },
    {
      label: 'Open invoices',
      value: derived.openInvoiceCount.toString(),
      icon: Receipt,
      href: '/app/invoices',
      subtle: 'Sent or overdue',
    },
  ] as const

  return (
    <>
      <PageHeader
        title={
          merchant
            ? `Welcome back${merchant.businessName ? `, ${merchant.businessName}` : ''}`
            : 'Welcome back'
        }
        docsSlug="overview"
        description="What's happening across your billing surface."
      />

      <motion.div
        {...inViewOnce}
        variants={stagger(0.04, 0.06)}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-tour="kpis"
      >
        {KPIS.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </motion.div>

      <VolumeChartCard series={derived.series} isLoading={sessionsQuery.isPending} />

      <div className="mt-6">{showGettingStarted ? <GetStartedCard /> : <RecentSessionsCard />}</div>
    </>
  )
}

function VolumeChartCard({
  series,
  isLoading,
}: {
  series: { day: string; volume: number; count: number }[]
  isLoading: boolean
}) {
  const total = series.reduce((s, p) => s + p.volume, 0)
  const empty = !isLoading && total === 0

  return (
    <Card className="shadow-sub-card border-border/60 mt-6" data-tour="volume-chart">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-poppins font-semibold">Volume (30 days)</h3>
            <p className="text-muted-foreground text-xs">Confirmed payments, USDC.</p>
          </div>
          <div className="text-right">
            <div className="font-sora text-lg font-semibold">
              {total.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
            </div>
            <div className="text-muted-foreground text-xs">Rolling total</div>
          </div>
        </div>
        <div className="mt-4">
          {isLoading ? (
            <div className="bg-muted/30 h-[220px] animate-pulse rounded-md" />
          ) : empty ? (
            <div className="text-muted-foreground flex h-[220px] items-center justify-center text-xs">
              No confirmed payments in the last 30 days.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={series} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="strimzVol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#02C76A" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#02C76A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)} USDC`, 'Volume']}
                  labelStyle={{ fontSize: 11 }}
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="#02C76A"
                  strokeWidth={2}
                  fill="url(#strimzVol)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function GetStartedCard() {
  return (
    <Card className="shadow-sub-card border-border/60" data-tour="get-started">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-poppins font-semibold">Get started</h3>
          <Link
            href="https://strimz.finance/docs/getting-started/quickstart"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-[#02C76A] hover:underline"
          >
            Open the docs →
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {STEPS.map((s) => (
            <Link
              key={s.n}
              href={s.href}
              className="border-border/60 bg-background group flex items-start gap-3 rounded-lg border p-4 transition-all hover:border-[#02C76A]/40 hover:shadow-sm"
            >
              <div className="font-sora flex size-8 shrink-0 items-center justify-center rounded-full bg-[#02C76A]/10 text-sm font-semibold text-[#02C76A]">
                {s.n}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{s.t}</div>
                <div className="text-muted-foreground mt-0.5 text-xs">{s.d}</div>
              </div>
              <ArrowUpRight className="text-muted-foreground/40 group-hover:text-foreground size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function RecentSessionsCard() {
  const { data, isLoading } = usePaymentSessions(
    { status: 'confirmed', limit: 5 },
    { select: (page) => page.data },
  )

  return (
    <Card className="shadow-sub-card border-border/60">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-poppins font-semibold">Recent activity</h3>
          <Link
            href="/app/payment-sessions"
            className="text-xs font-medium text-[#02C76A] hover:underline"
          >
            View all →
          </Link>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="border-border/60 bg-muted/30 h-14 animate-pulse rounded-lg border"
              />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">
            No confirmed payments yet.
          </p>
        ) : (
          <div className="space-y-2">
            {data.map((session) => (
              <div
                key={session.id}
                className="border-border/60 flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {session.description ?? 'Payment'}
                  </div>
                  <code className="text-muted-foreground text-[11px]">
                    {session.id.slice(0, 14)}…
                  </code>
                </div>
                <div className="font-mono text-sm">
                  {formatTokenAmount(session.amount, session.currency)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
