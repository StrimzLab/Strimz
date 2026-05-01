'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight, CreditCard, Receipt, Users, Wallet } from 'lucide-react'
import { Button, Card, CardContent } from '@strimz/ui'
import { PageHeader } from '@/components/dashboard/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { EarningsChart } from '@/components/dashboard/earnings-chart'
import { stagger, inViewOnce } from '@/lib/motion'

const KPIS = [
  { label: 'MRR', value: '$0', icon: Wallet, href: '/app/analytics', subtle: 'No active subscriptions yet' },
  { label: 'Active subscribers', value: '0', icon: Users, href: '/app/subscriptions', subtle: 'Customers on a plan' },
  { label: '7-day volume', value: '$0', icon: CreditCard, href: '/app/payment-sessions', subtle: 'Confirmed transactions' },
  { label: 'Open invoices', value: '0', icon: Receipt, href: '/app/invoices', subtle: 'Sent or overdue' },
] as const

const STEPS = [
  { n: 1, t: 'Complete onboarding', d: 'Add your business info and a payout address.', href: '/app/onboarding' },
  { n: 2, t: 'Issue your first API key', d: 'Test mode is free. Live mode unlocks after KYB + 2FA.', href: '/app/api-keys' },
  { n: 3, t: 'Send a test payment', d: 'Charge a test session and watch it land in real-time.', href: '/app/payment-sessions' },
  { n: 4, t: 'Wire a webhook', d: 'Add an HTTPS endpoint and send a test event.', href: '/app/webhooks' },
] as const

const READINESS = [
  'Verify your email',
  'Enable two-factor auth',
  'Complete business onboarding',
  'Set a payout wallet address',
] as const

export default function DashboardHome() {
  return (
    <>
      <PageHeader title="Welcome back" description="Here's what's happening across your billing surface." />

      <motion.div
        {...inViewOnce}
        variants={stagger(0.04, 0.06)}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {KPIS.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </motion.div>

      <div className="mt-8">
        <EarningsChart />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="strimz-card-shadow border-border/60 lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-poppins font-semibold">Get started</h3>
              <Link href="/docs/getting-started" className="text-xs font-medium text-[#02C76A] hover:underline">
                Open the docs →
              </Link>
            </div>
            <div className="space-y-3">
              {STEPS.map((s) => (
                <Link
                  key={s.n}
                  href={s.href}
                  className="group flex items-center gap-4 rounded-lg border border-border/60 bg-background p-4 transition-all hover:border-[#02C76A]/40 hover:shadow-sm"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#02C76A]/10 font-sora text-sm font-semibold text-[#02C76A]">
                    {s.n}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.t}</div>
                    <div className="text-xs text-muted-foreground">{s.d}</div>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="strimz-card-shadow border-border/60">
          <CardContent className="p-6">
            <h3 className="font-poppins font-semibold">Live mode readiness</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Complete these to issue live API keys.
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              {READINESS.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <div className="mt-2 size-1.5 rounded-full bg-muted-foreground/40" />
                  {c}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6 w-full" variant="outline">
              <Link href="/app/onboarding">Continue onboarding</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
