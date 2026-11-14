'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight, Check, CreditCard, LineChart, Receipt, Users, Wallet } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button, Card, CardContent } from '@strimz/ui'

import { PageHeader } from '@/components/dashboard/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { stagger, inViewOnce } from '@/lib/motion'
import { formatTokenAmount, tokenAmountToNumber } from '@/lib/format'
import { bucketVolumeDays, formatCurrencyAmounts, utcDayStart } from '@/lib/currency-totals'
import { homeCards, summaryValue } from '@/lib/stats-summary'
import { paymentCurrencies } from '@strimz/shared-types'
import { useDashboardTour } from '@/hooks/use-dashboard-tour'
import { NEW_PAYMENT_LINK_HREF, firstRunSteps, type FirstRunPath } from '@/lib/first-run'
import {
  useMerchantMe,
  useMrr,
  usePaymentSessions,
  useStatsSummary,
  useSubscriptionPlans,
  useStatsVolume,
} from '@/hooks/api'

const CHART_DAYS = 30

export default function DashboardHome() {
  const merchantQuery = useMerchantMe()
  const mrrQuery = useMrr()
  const summaryQuery = useStatsSummary()
  const [chartRange] = React.useState(() => {
    const now = Date.now()
    return {
      nowMs: now,
      from: new Date(utcDayStart(now, CHART_DAYS - 1)).toISOString(),
      to: new Date(now).toISOString(),
    }
  })
  const volumeQuery = useStatsVolume({ from: chartRange.from, to: chartRange.to })

  useDashboardTour({ enabled: Boolean(merchantQuery.data) })

  const cards = summaryQuery.data ? homeCards(summaryQuery.data) : null

  const chart = React.useMemo(() => {
    // Per-day series for the volume chart. We index into a 30-slot
    // array keyed by midnight-UTC day so the chart shows a stable
    // x-axis even when a day has no confirmed transactions.
    const dayLabel = (d: Date) =>
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const rows = volumeQuery.data?.data ?? []
    const currencies = paymentCurrencies.filter((c) => rows.some((r) => r.currency === c))
    const buckets = bucketVolumeDays(rows, chartRange.nowMs, CHART_DAYS)
    return {
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
  }, [volumeQuery.data, chartRange.nowMs])

  const merchant = merchantQuery.data
  const showGettingStarted = cards ? !cards.anyConfirmedAtAll : false

  const KPIS = [
    {
      label: 'Monthly recurring revenue',
      value: summaryValue(mrrQuery, (d) => formatCurrencyAmounts(d.mrr)),
      icon: Wallet,
      href: '/app/analytics',
      subtle: mrrQuery.data
        ? 'From active subscriptions'
        : mrrQuery.isError
          ? 'Could not load recurring revenue'
          : 'Loading…',
    },
    {
      label: 'Active subscribers',
      value: summaryValue(mrrQuery, (d) => d.activeSubscribers.toLocaleString()),
      icon: Users,
      href: '/app/subscriptions',
      subtle: 'Paying you every period',
    },
    {
      label: 'Last 7 days',
      value: summaryValue(summaryQuery, (d) => homeCards(d).volume7d),
      icon: CreditCard,
      href: '/app/payment-sessions',
      subtle: cards
        ? cards.volume7dNote
        : summaryQuery.isError
          ? 'Could not load volume'
          : 'Loading…',
    },
    {
      label: 'Open invoices',
      value: summaryValue(summaryQuery, (d) => homeCards(d).openInvoices),
      icon: Receipt,
      href: '/app/invoices',
      subtle: 'Sent and not yet paid',
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
        series={chart.series}
        currencies={chart.currencies}
        total={summaryValue(summaryQuery, (d) => homeCards(d).volume30d)}
        isLoading={volumeQuery.isPending}
        error={volumeQuery.isError ? volumeQuery.error.message : null}
        onRetry={() => void volumeQuery.refetch()}
      />

      <div className="mt-6">
        {showGettingStarted ? <FirstRunCard paid={false} /> : <RecentSessionsCard />}
      </div>
    </>
  )
}

const CURRENCY_STROKE: Record<string, string> = { USDC: '#02C76A', EURC: '#2563EB' }

function VolumeChartCard({
  series,
  currencies,
  total,
  isLoading,
  error,
  onRetry,
}: {
  series: ({ day: string; count: number } & Record<string, number | string>)[]
  currencies: string[]
  total: string
  isLoading: boolean
  error: string | null
  onRetry: () => void
}) {
  const empty = !isLoading && currencies.length === 0

  return (
    <Card className="shadow-sub-card border-border/60 mt-6" data-tour="volume-chart">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-poppins font-semibold">Last 30 days</h3>
            <p className="text-muted-foreground text-xs">
              Confirmed payments and subscription charges, per currency.
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
          ) : error ? (
            <div className="text-muted-foreground flex h-[220px] flex-col items-center justify-center gap-2 text-xs">
              <span>Could not load volume: {error}</span>
              <button
                type="button"
                onClick={onRetry}
                className="text-accent font-medium hover:underline"
              >
                Retry
              </button>
            </div>
          ) : empty ? (
            <div className="flex h-[220px] flex-col items-center justify-center gap-3 text-center">
              <span className="bg-accent/10 text-accent grid size-11 place-items-center rounded-xl">
                <LineChart className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">Your first payment will show here</p>
                <p className="text-muted-foreground text-xs">
                  Confirmed payments and subscription charges from the last 30 days.
                </p>
              </div>
              <Button asChild size="sm">
                <Link href={NEW_PAYMENT_LINK_HREF}>Create a payment link</Link>
              </Button>
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

function FirstRunCard({ paid }: { paid: boolean }) {
  const sessionsQuery = usePaymentSessions({ limit: 1 }, { select: (page) => page.data.length })
  const plansQuery = useSubscriptionPlans({ limit: 1 }, { select: (page) => page.data.length })
  const created = (sessionsQuery.data ?? 0) > 0 || (plansQuery.data ?? 0) > 0
  const paths = firstRunSteps({ created, paid })
  const [pathId, setPathId] = React.useState<FirstRunPath['id']>('no-code')
  const path = paths.find((p) => p.id === pathId)
  if (!path) return null

  return (
    <Card className="shadow-sub-card border-border/60" data-tour="get-started">
      <CardContent className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-poppins font-semibold">Get paid</h3>
            <p className="text-muted-foreground text-xs">
              Take your first payment. Pick the way that suits you.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="How you will set up"
            className="bg-muted flex rounded-lg p-1"
          >
            {paths.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === path.id}
                onClick={() => setPathId(p.id)}
                className={
                  p.id === path.id
                    ? 'bg-card text-foreground rounded-md px-3 py-1.5 text-xs font-medium shadow-sm'
                    : 'text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-xs font-medium'
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <ol role="tabpanel" className="grid gap-3 md:grid-cols-3">
          {path.steps.map((s, i) => (
            <li key={s.title}>
              <Link
                href={s.href}
                className="border-border/60 bg-background hover:border-accent/40 group flex h-full items-start gap-3 rounded-lg border p-4 transition-all hover:shadow-sm"
              >
                <span
                  className={
                    s.done
                      ? 'bg-accent text-ink flex size-8 shrink-0 items-center justify-center rounded-full'
                      : 'font-sora bg-accent/10 text-accent flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold'
                  }
                >
                  {s.done ? <Check className="size-4" aria-label="Done" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{s.title}</span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">{s.body}</span>
                </span>
                <ArrowUpRight className="text-muted-foreground/40 group-hover:text-foreground size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ol>
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
            className="text-accent text-xs font-medium hover:underline"
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
