'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, Calendar } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent } from '@strimz/ui'

const SAMPLE = [
  { day: 'Day 1', volume: 0 },
  { day: 'Day 2', volume: 320 },
  { day: 'Day 3', volume: 280 },
  { day: 'Day 4', volume: 540 },
  { day: 'Day 5', volume: 480 },
  { day: 'Day 6', volume: 720 },
  { day: 'Day 7', volume: 850 },
] as const

/**
 * Earnings chart card — direct port of the prior business-dashboard
 * earnings card, modularised, themed against `bg-card`/`text-foreground`
 * instead of hard-coded `#FFFFFF` / `#050020` so dark mode works.
 */
export function EarningsChart() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-sora text-lg font-semibold">Earnings</h3>
        <button
          type="button"
          className="strimz-card-shadow inline-flex h-9 items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 text-sm transition-colors hover:bg-muted"
        >
          <Calendar className="size-4" />
          Last 7 days
        </button>
      </div>

      <Card className="strimz-card-shadow border-border/60">
        <CardContent className="grid gap-4 p-6 lg:grid-cols-4 lg:gap-0">
          <div className="space-y-4 lg:col-span-3 lg:pr-6">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Volume</div>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <h2 className="font-sora text-3xl font-bold">
                  $1,255<span className="text-base text-muted-foreground">.50 USD</span>
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#02C76A]/10 px-2 py-0.5 text-xs font-medium text-[#02C76A]">
                  <ArrowUpRight className="size-3" />
                  +7%
                </span>
                <span className="text-xs text-muted-foreground">vs. previous 7 days</span>
              </div>
            </div>
            <div className="h-48 w-full">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={SAMPLE} margin={{ top: 5, right: 5, left: -16, bottom: 5 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
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
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="volume"
                      stroke="#02C76A"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4, fill: '#02C76A' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="space-y-4 border-t border-border/40 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">All-time volume</div>
              <div className="mt-1 font-sora text-xl font-bold">
                $345,250<span className="text-sm text-muted-foreground">.50</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">USDC</div>
              <div className="mt-1 font-sora text-xl font-bold">
                $201,250<span className="text-sm text-muted-foreground">.00</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">EURC</div>
              <div className="mt-1 font-sora text-xl font-bold">
                €0<span className="text-sm text-muted-foreground">.00</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
