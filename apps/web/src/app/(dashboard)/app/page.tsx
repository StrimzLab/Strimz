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
import { bucketDailyTotals, formatCurrencyTotals, sumByCurrency } from '@/lib/currency-totals'
import { useDashboardTour } from '@/hooks/use-dashboard-tour'
import { useInvoices, useMerchantMe, useMrr, usePaymentSessions } from '@/hooks/api'

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

const SESSION_SAMPLE = 100
const INVOICE_SAMPLE = 100

export default function DashboardHome() {
  const merchantQuery = useMerchantMe()
  const mrrQuery = useMrr()
  const sessionsQuery = usePaymentSessions({ limit: SESSION_SAMPLE })
  const invoicesQuery = useInvoices({ limit: INVOICE_SAMPLE })

  useDashboardTour({ enabled: Boolean(merchantQuery.data) })

  const derived = React.useMemo(() => {
    const now = Date.now()
    const sevenDays = 7 * 86_400_000
    const thirtyDays = 30 * 86_400_000

    const sessions = sessionsQuery.data?.data ?? []
    const confirmed = sessions.filter((s) => s.status === 'confirmed')
    const confirmed7d = confirmed.filter((s) => now - new Date(s.updatedAt).getTime() < sevenDays)
    const confirmed30d = confirmed.filter((s) => now - new Date(s.updatedAt).getTime() < thirtyDays)
    const volume7d = sumByCurrency(confirmed7d, (r) => ({ amount: r.amount, currency: r.currency }))
    const volume30d = sumByCurrency(confirmed30d, (r) => ({
      amount: r.amount,
      currency: r.currency,
    }))

    const invoices = invoicesQuery.data?.data ?? []
    const openInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue')

    // Per-day series for the volume chart. We index into a 30-slot
    // array keyed by midnight-UTC day so the chart shows a stable
    // x-axis even when a day has no confirmed transactions.
    const dayLabel = (d: Date) =>
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const currencies = volume30d.map((t) => t.currency)
    const buckets = bucketDailyTotals(
      confirmed30d.map((s) => ({ at: s.updatedAt, amount: s.amount, currency: s.currency })),
      now,
      30,
    )
    return {
      volume7d,
      volume30d,
      confirmedCount7d: confirmed7d.length,
      sessionsPartial: sessionsQuery.data?.hasMore ?? false,
      openInvoiceCount: openInvoices.length,
      invoicesPartial: invoicesQuery.data?.hasMore ?? false,
      anyConfirmedAtAll: confirmed.length > 0,
      currencies,
      series: buckets.map((b) => ({
        day: dayLabel(new Date(b.dayStart)),
        count: b.count,
        ...Object.fromEntries(
          currencies.map((currency) => [
            currency,
            tokenAmountToNumber((b.totals[currency] ?? 0n).toString()),
          ]),
        ),
      })),
    }
  }, [sessionsQuery.data, invoicesQuery.data])

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
      value: mrrQuery.data ? mrrQuery.data.activeSubscribers.toLocaleString() : '—',
      icon: Users,
      href: '/app/subscriptions',
      subtle: 'Customers cycling',
    },
    {
      label: '7-day volume',
      value: formatCurrencyTotals(derived.volume7d),
      icon: CreditCard,
      href: '/app/payment-sessions',
      subtle: derived.sessionsPartial
        ? `${derived.confirmedCount7d} confirmed in the latest ${SESSION_SAMPLE} sessions`
        : `${derived.confirmedCount7d} confirmed`,
    },
    {
      label: 'Open invoices',
      value: derived.invoicesPartial
        ? `${derived.openInvoiceCount}+`
        : derived.openInvoiceCount.toString(),
      icon: Receipt,
      href: '/app/invoices',
      subtle: derived.invoicesPartial
        ? `Sent or overdue in the latest ${INVOICE_SAMPLE} invoices`
        : 'Sent or overdue',
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

      <VolumeChartCard
        series={derived.series}
        currencies={derived.currencies}
        total={formatCurrencyTotals(derived.volume30d)}
        partial={derived.sessionsPartial}
        isLoading={sessionsQuery.isPending}
      />

      <div className="mt-6">{showGettingStarted ? <GetStartedCard /> : <RecentSessionsCard />}</div>
    </>
  )
}

const CURRENCY_STROKE: Record<string, string> = { USDC: '#02C76A', EURC: '#2563EB' }

function VolumeChartCard({
  series,
  currencies,
  total,
  partial,
  isLoading,
}: {
  series: ({ day: string; count: number } & Record<string, number | string>)[]
  currencies: string[]
  total: string
  partial: boolean
  isLoading: boolean
}) {
  const empty = !isLoading && currencies.length === 0

  return (
    <Card className="shadow-sub-card border-border/60 mt-6" data-tour="volume-chart">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-poppins font-semibold">Volume (30 days)</h3>
            <p className="text-muted-foreground text-xs">
              {partial
                ? `Confirmed payments in the latest ${SESSION_SAMPLE} sessions, per currency.`
                : 'Confirmed payments, per currency.'}
            </p>
          </div>
          <div className="text-right">
            <div className="font-sora text-lg font-semibold">{total}</div>
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
                  {currencies.map((currency) => (
                    <linearGradient
                      key={currency}
                      id={`strimzVol-${currency}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={CURRENCY_STROKE[currency] ?? '#58556A'}
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="100%"
                        stopColor={CURRENCY_STROKE[currency] ?? '#58556A'}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  ))}
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
                  formatter={(value: number, currency: string) => [
                    `${value.toFixed(2)} ${currency}`,
                    'Volume',
                  ]}
                  labelStyle={{ fontSize: 11 }}
                />
                {currencies.map((currency) => (
                  <Area
                    key={currency}
                    type="monotone"
                    dataKey={currency}
                    name={currency}
                    stroke={CURRENCY_STROKE[currency] ?? '#58556A'}
                    strokeWidth={2}
                    fill={`url(#strimzVol-${currency})`}
                  />
                ))}
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
