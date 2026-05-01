'use client'

import { BarChart3 } from 'lucide-react'
import { Card, CardContent } from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { EmptyState } from '@/components/dashboard/empty-state'

const KPIS = [
  { label: 'Conversion (30d)', value: '—' },
  { label: 'Churn (12m avg)', value: '—' },
  { label: 'MRR', value: '$0' },
  { label: 'Forecast — next 30d', value: '—' },
] as const

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="SQL-backed conversion, churn, MRR, LTV, and a 90-day linear-regression forecast."
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <Card key={k.label} className="border-border/60">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-muted-foreground">{k.label}</div>
              <div className="mt-2 text-2xl font-bold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <EmptyState
        icon={BarChart3}
        title="No data yet"
        description="Charts populate here as soon as you have confirmed transactions and active subscriptions."
      />
    </>
  )
}
