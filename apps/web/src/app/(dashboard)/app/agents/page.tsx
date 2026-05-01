'use client'

import { Bot } from 'lucide-react'
import { Badge, Card, CardContent, Switch } from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'

const CAPABILITIES = [
  { key: 'recovery', name: 'Recovery', desc: 'Email customers on at-risk subscriptions per your strategy.' },
  { key: 'cashflow', name: 'Cashflow', desc: 'Daily digest, anomaly detection, and yield recommendations.' },
  { key: 'commerce', name: 'Commerce', desc: 'Vendor allowlist, monthly spend cap, awaiting-approval gating.' },
  { key: 'pricing_intelligence', name: 'Pricing intelligence', desc: 'Monthly MRR, churn, and 90-day forecast email.' },
  { key: 'routing', name: 'Routing (CCTP V2)', desc: 'Cross-chain settlement so customers can pay from any USDC chain.' },
  { key: 'identity', name: 'Identity', desc: 'Surface KYB / business-info verification flows in your dashboard.' },
] as const

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        title="AutoPay Agent"
        description="Background process that runs the capabilities you opt into. No private keys; no autonomous fund movement."
      />

      <div className="mb-6 flex items-center gap-2">
        <Bot className="size-4 text-[#02C76A]" />
        <Badge variant="secondary">Read activity at /app/agents/activity</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CAPABILITIES.map((c) => (
          <Card key={c.key} className="border-border/60">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold">{c.name}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
