'use client'

import * as React from 'react'
import { Download, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { toast } from 'sonner'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Button,
  Card,
  CardContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { downloadCsv } from '@/lib/csv-export'
import {
  ACTIVE_SUBSCRIBERS,
  CHURN,
  CONVERSION,
  CURRENT_MRR_USDC,
  DAILY_VOLUME,
  FORECAST_CONFIDENCE,
  FORECAST_NEXT_30,
  MRR_HISTORY,
  TOP_CUSTOMERS_LTV,
} from '@/data/analytics'
import { formatUsdc, formatUsdcCompact, shortAddress } from '@/data/_seed'

export default function AnalyticsPage() {
  const [range, setRange] = React.useState<'30d' | '60d'>('60d')
  const dailyData = range === '30d' ? DAILY_VOLUME.slice(-30) : DAILY_VOLUME

  const grossLast30 = DAILY_VOLUME.slice(-30).reduce((s, p) => s + p.grossUsdc, 0)
  const grossPrior30 = DAILY_VOLUME.slice(-60, -30).reduce((s, p) => s + p.grossUsdc, 0)
  const grossDeltaPct = grossPrior30 > 0 ? ((grossLast30 - grossPrior30) / grossPrior30) * 100 : 0

  const mrrPrior = MRR_HISTORY.length > 1 ? MRR_HISTORY[MRR_HISTORY.length - 2]!.mrrUsdc : 0
  const mrrDeltaPct = mrrPrior > 0 ? ((CURRENT_MRR_USDC - mrrPrior) / mrrPrior) * 100 : 0

  const churnAvg12m = CHURN.reduce((s, p) => s + p.churnRate, 0) / CHURN.length
  const conversionAvg30d = CONVERSION.reduce((s, p) => s + p.rate, 0) / CONVERSION.length

  const projectedNext30 = FORECAST_NEXT_30.reduce((s, p) => s + p.projectedNetUsdc, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Conversion, churn, MRR, LTV, and a 90-day forecast. The AutoPay Agent uses the same numbers in its monthly summary."
        action={
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={(v) => setRange(v as '30d' | '60d')}>
              <SelectTrigger className="h-9 w-[140px] whitespace-nowrap">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="60d">Last 60 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                downloadCsv('daily-volume.csv', DAILY_VOLUME, [
                  { key: 'day', header: 'Day' },
                  { key: 'grossUsdc', header: 'Gross (smallest units)' },
                  { key: 'feeUsdc', header: 'Fees (smallest units)' },
                  { key: 'netUsdc', header: 'Net (smallest units)' },
                  { key: 'transactionCount', header: 'Transactions' },
                  { key: 'newCustomers', header: 'New customers' },
                ])
                toast.success('Exported daily-volume.csv')
              }}
            >
              <Download className="mr-1.5 size-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Gross volume (30d)"
          value={`${formatUsdcCompact(grossLast30)} USDC`}
          delta={grossDeltaPct}
        />
        <KpiCard
          label="MRR"
          value={`${formatUsdcCompact(CURRENT_MRR_USDC)} USDC`}
          delta={mrrDeltaPct}
          note={`${ACTIVE_SUBSCRIBERS} active subscribers`}
        />
        <KpiCard
          label="Conversion (30d avg)"
          value={`${(conversionAvg30d * 100).toFixed(1)}%`}
          note="confirmed / created"
        />
        <KpiCard
          label="Churn (12m avg)"
          value={`${(churnAvg12m * 100).toFixed(1)}%`}
          delta={-((churnAvg12m - CHURN[0]!.churnRate) / CHURN[0]!.churnRate) * 100}
          inverse
        />
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="mrr">MRR + churn</TabsTrigger>
          <TabsTrigger value="conversion">Conversion</TabsTrigger>
          <TabsTrigger value="ltv">LTV</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4">
          <Card className="shadow-sub-card border-border/60">
            <CardContent className="p-5">
              <ChartHeader title={`Daily revenue · last ${range === '30d' ? 30 : 60} days`} />
              <ChartWrap>
                <AreaChart
                  data={dailyData.map((p) => ({
                    day: p.day.slice(5),
                    gross: p.grossUsdc / 1_000_000,
                    fees: p.feeUsdc / 1_000_000,
                    net: p.netUsdc / 1_000_000,
                  }))}
                >
                  <defs>
                    <linearGradient id="g-gross" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#02C76A" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#02C76A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                  />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(2)} USDC`} />
                  <Area
                    type="monotone"
                    dataKey="gross"
                    stroke="#02C76A"
                    strokeWidth={2.5}
                    fill="url(#g-gross)"
                    name="Gross"
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    stroke="#050020"
                    strokeWidth={1.8}
                    dot={false}
                    name="Net"
                  />
                </AreaChart>
              </ChartWrap>
            </CardContent>
          </Card>

          <Card className="shadow-sub-card border-border/60 mt-4">
            <CardContent className="p-5">
              <ChartHeader title="Transaction count" />
              <ChartWrap height={200}>
                <BarChart
                  data={dailyData.map((p) => ({ day: p.day.slice(5), count: p.transactionCount }))}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" fill="#02C76A" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartWrap>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mrr" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="shadow-sub-card border-border/60">
            <CardContent className="p-5">
              <ChartHeader title="MRR · last 12 months" />
              <ChartWrap>
                <AreaChart
                  data={MRR_HISTORY.map((p) => ({
                    month: p.month.slice(2),
                    mrr: p.mrrUsdc / 1_000_000,
                    subs: p.activeSubscribers,
                  }))}
                >
                  <defs>
                    <linearGradient id="g-mrr" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#02C76A" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#02C76A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                  />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(2)} USDC`} />
                  <Area
                    type="monotone"
                    dataKey="mrr"
                    stroke="#02C76A"
                    strokeWidth={2.5}
                    fill="url(#g-mrr)"
                    name="MRR"
                  />
                </AreaChart>
              </ChartWrap>
            </CardContent>
          </Card>

          <Card className="shadow-sub-card border-border/60">
            <CardContent className="p-5">
              <ChartHeader title="Churn rate · last 12 months" />
              <ChartWrap>
                <LineChart
                  data={CHURN.map((p) => ({
                    month: p.month.slice(2),
                    pct: +(p.churnRate * 100).toFixed(2),
                  }))}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                  />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(2)}%`} />
                  <Line
                    type="monotone"
                    dataKey="pct"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#f97316' }}
                    name="Churn rate"
                  />
                </LineChart>
              </ChartWrap>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversion" className="mt-4">
          <Card className="shadow-sub-card border-border/60">
            <CardContent className="p-5">
              <ChartHeader
                title="Session conversion · last 30 days"
                subtitle="Confirmed sessions ÷ created sessions per UTC day"
              />
              <ChartWrap height={300}>
                <BarChart
                  data={CONVERSION.map((p) => ({
                    day: p.day.slice(5),
                    created: p.created,
                    confirmed: p.confirmed,
                    rate: +(p.rate * 100).toFixed(1),
                  }))}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="count"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="rate"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    yAxisId="count"
                    dataKey="created"
                    fill="#cbd5e1"
                    name="Created"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    yAxisId="count"
                    dataKey="confirmed"
                    fill="#02C76A"
                    name="Confirmed"
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    yAxisId="rate"
                    type="monotone"
                    dataKey="rate"
                    stroke="#050020"
                    strokeWidth={2}
                    dot={false}
                    name="Rate %"
                  />
                </BarChart>
              </ChartWrap>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ltv" className="mt-4">
          <Card className="shadow-sub-card border-border/60">
            <CardContent className="p-5">
              <ChartHeader title="Top customers by lifetime value" />
              <ChartWrap height={360}>
                <BarChart
                  layout="vertical"
                  data={TOP_CUSTOMERS_LTV.map((c) => ({
                    wallet: shortAddress(c.walletAddress),
                    spend: c.totalSpentUsdc / 1_000_000,
                  }))}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="wallet"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    width={120}
                  />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(2)} USDC`} />
                  <Bar dataKey="spend" fill="#02C76A" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartWrap>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <Card className="shadow-sub-card border-border/60">
            <CardContent className="p-5">
              <div className="mb-4 flex items-end justify-between">
                <ChartHeader
                  title="Net revenue forecast · next 30 days"
                  subtitle="Linear-regression projection based on the last 90 days of confirmed transactions"
                />
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Activity className="size-3.5" />
                  Confidence:{' '}
                  <span className="text-foreground font-medium capitalize">
                    {FORECAST_CONFIDENCE}
                  </span>
                </div>
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <Stat
                  label="Projected (next 30d)"
                  value={`${formatUsdcCompact(projectedNext30)} USDC`}
                />
                <Stat label="Daily average" value={`${formatUsdc(projectedNext30 / 30)} USDC`} />
                <Stat
                  label="vs. last 30d"
                  value={`${(((projectedNext30 - DAILY_VOLUME.slice(-30).reduce((s, p) => s + p.netUsdc, 0)) / DAILY_VOLUME.slice(-30).reduce((s, p) => s + p.netUsdc, 0)) * 100).toFixed(1)}%`}
                />
              </div>
              <ChartWrap>
                <AreaChart
                  data={[
                    ...DAILY_VOLUME.slice(-30).map((p) => ({
                      day: p.day.slice(5),
                      historical: p.netUsdc / 1_000_000,
                      projected: null as number | null,
                    })),
                    ...FORECAST_NEXT_30.map((p) => ({
                      day: p.day.slice(5),
                      historical: null as number | null,
                      projected: p.projectedNetUsdc / 1_000_000,
                    })),
                  ]}
                >
                  <defs>
                    <linearGradient id="g-fc" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#02C76A" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#02C76A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                  />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(v: unknown) =>
                      typeof v === 'number' ? `${v.toFixed(2)} USDC` : '—'
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="historical"
                    stroke="#050020"
                    strokeWidth={2}
                    fill="url(#g-fc)"
                    name="Historical"
                    connectNulls
                  />
                  <Area
                    type="monotone"
                    dataKey="projected"
                    stroke="#02C76A"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    fill="url(#g-fc)"
                    name="Projected"
                    connectNulls
                  />
                </AreaChart>
              </ChartWrap>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 12,
  },
} as const

function ChartWrap({ children, height = 280 }: { children: React.ReactElement; height?: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

function ChartHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-sora text-sm font-semibold">{title}</h3>
      {subtitle ? <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p> : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/60 rounded-lg border p-3">
      <div className="text-muted-foreground text-[11px]">{label}</div>
      <div className="font-sora mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  delta,
  note,
  inverse,
}: {
  label: string
  value: string
  delta?: number
  note?: string
  inverse?: boolean
}) {
  const isUp = (delta ?? 0) >= 0
  const positive = inverse ? !isUp : isUp
  return (
    <div className="shadow-sub-card border-border/60 bg-background rounded-xl border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-sora text-2xl font-semibold">{value}</span>
        {delta != null ? (
          <span
            className={[
              'inline-flex items-center gap-0.5 text-xs font-medium',
              positive ? 'text-[#02C76A]' : 'text-rose-600',
            ].join(' ')}
          >
            {isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
        ) : null}
      </div>
      {note ? <div className="text-muted-foreground mt-1 text-xs">{note}</div> : null}
    </div>
  )
}
