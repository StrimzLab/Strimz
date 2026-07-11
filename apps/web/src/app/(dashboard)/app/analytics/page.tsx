'use client'

import * as React from 'react'
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
import { AlertCircle, RefreshCcw } from 'lucide-react'
import { Button, Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from '@strimz/ui'

import { PageHeader } from '@/components/dashboard/page-header'
import { formatTokenAmount, shortAddress } from '@/lib/format'
import { useChurn, useConversion, useForecast, useLtv, useMrr } from '@/hooks/api'

export default function AnalyticsPage() {
  const mrrQuery = useMrr()
  const forecastQuery = useForecast()
  const conversionQuery = useConversion({})
  const churnQuery = useChurn({})
  const ltvQuery = useLtv({ limit: 10 })

  const mrr = mrrQuery.data
  const forecast = forecastQuery.data

  const conversionData = React.useMemo(
    () =>
      (conversionQuery.data?.data ?? []).map((p) => ({
        day: new Date(p.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        rate: p.created === 0 ? 0 : (100 * p.confirmed) / p.created,
        created: p.created,
        confirmed: p.confirmed,
      })),
    [conversionQuery.data],
  )

  const churnData = React.useMemo(
    () =>
      (churnQuery.data?.data ?? []).map((p) => ({
        month: new Date(p.month).toLocaleDateString(undefined, {
          month: 'short',
          year: '2-digit',
        }),
        rate: p.rate * 100,
        cancelled: p.cancelled,
      })),
    [churnQuery.data],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        docsSlug="analytics"
        description="The numbers you care about: conversion, churn, MRR, LTV, and a simple 90-day forecast."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="MRR"
          value={mrr ? formatTokenAmount(mrr.mrr, 'USDC') : '—'}
          loading={mrrQuery.isLoading}
          subtle={mrr ? `${mrr.activeSubscribers} active subs` : undefined}
        />
        <Kpi
          label="Conversion (30d avg)"
          value={(() => {
            const points = conversionQuery.data?.data ?? []
            if (points.length === 0) return ', '
            // The endpoint returns per-day {created, confirmed}; we
            // compute the period-wide rate as sum/sum, NOT the mean of
            // per-day rates. The mean would over-weight days with tiny
            // sample sizes.
            const totalCreated = points.reduce((s, p) => s + p.created, 0)
            const totalConfirmed = points.reduce((s, p) => s + p.confirmed, 0)
            if (totalCreated === 0) return '0%'
            return `${Math.round((100 * totalConfirmed) / totalCreated)}%`
          })()}
          loading={conversionQuery.isLoading}
          subtle="Confirmed / created"
        />
        <Kpi
          label="Churn (last month)"
          value={
            churnData.length > 0 ? `${churnData[churnData.length - 1]!.rate.toFixed(1)}%` : '—'
          }
          loading={churnQuery.isLoading}
          subtle="Cancelled + lapsed"
          dangerIfAbove={5}
          numericForCompare={churnData.length > 0 ? churnData[churnData.length - 1]!.rate : null}
        />
        <Kpi
          label="Forecast. Next 30d"
          value={forecast ? formatTokenAmount(forecast.next30, 'USDC') : '—'}
          loading={forecastQuery.isLoading}
          subtle={forecast ? `${forecast.confidence} confidence` : undefined}
        />
      </div>

      <Tabs defaultValue="conversion">
        <TabsList>
          <TabsTrigger value="conversion">Conversion</TabsTrigger>
          <TabsTrigger value="churn">Churn</TabsTrigger>
          <TabsTrigger value="ltv">Top customers (LTV)</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="conversion" className="mt-4">
          <ChartCard
            title="Daily conversion rate"
            description="Confirmed sessions divided by created sessions, last 30 days."
            isLoading={conversionQuery.isLoading}
            isError={conversionQuery.isError}
            onRetry={conversionQuery.refetch}
            isEmpty={conversionData.length === 0}
            emptyMessage="No checkout sessions yet."
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={conversionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="Conversion %"
                  stroke="#02C76A"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        <TabsContent value="churn" className="mt-4">
          <ChartCard
            title="Monthly churn"
            description="Subscribers cancelled or lapsed, as a share of total subs each month."
            isLoading={churnQuery.isLoading}
            isError={churnQuery.isError}
            onRetry={churnQuery.refetch}
            isEmpty={churnData.length === 0}
            emptyMessage="No subscription history yet."
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={churnData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Bar dataKey="rate" name="Churn %" fill="#02C76A" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        <TabsContent value="ltv" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="p-6">
              <h3 className="font-sora text-base font-semibold">Top customers by spend</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                The customers who've paid you the most across confirmed transactions.
              </p>
              {ltvQuery.isLoading ? (
                <div className="mt-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="border-border/60 bg-muted/30 h-12 animate-pulse rounded-lg border"
                    />
                  ))}
                </div>
              ) : ltvQuery.data && ltvQuery.data.data.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {ltvQuery.data.data.map((row, idx) => (
                    <div
                      key={row.customerId}
                      className="border-border/60 flex items-center justify-between rounded-lg border px-3 py-2.5"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground w-6 font-mono text-xs">
                          #{idx + 1}
                        </span>
                        <code className="text-xs">{shortAddress(row.customerId)}</code>
                        <span className="text-muted-foreground text-xs">
                          {row.transactionCount} tx
                        </span>
                      </div>
                      <span className="font-mono text-sm font-medium">
                        {formatTokenAmount(row.totalSpend, 'USDC')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground mt-4 py-6 text-center text-xs">
                  No customer transactions yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <Card className="border-border/60">
            <CardContent className="p-6">
              <h3 className="font-sora text-base font-semibold">90-day forecast</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                Linear projection over your last 90 days of confirmed transaction revenue. Cheap
                model; useful for "next quarter" sizing.
              </p>
              {forecastQuery.isLoading ? (
                <div className="border-border/60 bg-muted/30 mt-4 h-32 animate-pulse rounded-lg border" />
              ) : forecast ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <ForecastBucket label="Next 30 days" value={forecast.next30} />
                  <ForecastBucket label="Next 60 days" value={forecast.next60} />
                  <ForecastBucket label="Next 90 days" value={forecast.next90} />
                </div>
              ) : null}
              {forecast?.confidence === 'low' ? (
                <div className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertCircle className="size-4 shrink-0" />
                  <p>
                    Low confidence. We need at least 30 days of transaction data for a meaningful
                    projection. Try again after a few more weeks of activity.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Kpi({
  label,
  value,
  loading,
  subtle,
  dangerIfAbove,
  numericForCompare,
}: {
  label: string
  value: string
  loading: boolean
  subtle?: string
  dangerIfAbove?: number
  numericForCompare?: number | null
}) {
  const isDanger =
    dangerIfAbove !== undefined &&
    numericForCompare !== null &&
    numericForCompare !== undefined &&
    numericForCompare > dangerIfAbove

  return (
    <Card className="shadow-sub-card border-border/60">
      <CardContent className="p-4">
        <div className="text-muted-foreground text-xs">{label}</div>
        {loading ? (
          <div className="bg-muted/60 mt-2 h-7 w-3/4 animate-pulse rounded" />
        ) : (
          <div
            className={[
              'font-sora mt-1 text-2xl font-semibold',
              isDanger ? 'text-rose-600' : '',
            ].join(' ')}
          >
            {value}
          </div>
        )}
        {subtle ? <div className="text-muted-foreground mt-1 text-xs">{subtle}</div> : null}
      </CardContent>
    </Card>
  )
}

function ForecastBucket({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/60 rounded-lg border p-4">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-sora mt-1 text-xl font-semibold">{formatTokenAmount(value, 'USDC')}</div>
    </div>
  )
}

function ChartCard({
  title,
  description,
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyMessage,
  children,
}: {
  title: string
  description: string
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  isEmpty: boolean
  emptyMessage: string
  children: React.ReactNode
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-6">
        <div>
          <h3 className="font-sora text-base font-semibold">{title}</h3>
          <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        </div>
        {isError ? (
          <div className="flex items-center justify-between rounded-md bg-rose-50 p-4">
            <span className="text-xs text-rose-700">Failed to load. Try again.</span>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCcw className="mr-1 size-3" /> Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="bg-muted/30 h-[300px] animate-pulse rounded-md" />
        ) : isEmpty ? (
          <div className="text-muted-foreground flex h-[300px] items-center justify-center text-xs">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
