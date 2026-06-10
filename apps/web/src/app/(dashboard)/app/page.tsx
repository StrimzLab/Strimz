'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight, CreditCard, Receipt, Users, Wallet } from 'lucide-react'
import { Button, Card, CardContent } from '@strimz/ui'

import { PageHeader } from '@/components/dashboard/page-header'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { stagger, inViewOnce } from '@/lib/motion'
import { formatTokenAmount, tokenAmountToNumber } from '@/lib/format'
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
    t: 'Complete onboarding',
    d: 'Add your business info and a payout address.',
    href: '/app/onboarding',
  },
  {
    n: 2,
    t: 'Issue your first API key',
    d: 'Test mode is free. Live mode unlocks after MFA + email verification.',
    href: '/app/api-keys',
  },
  {
    n: 3,
    t: 'Send a test payment',
    d: 'Create a test session, complete the hosted checkout, watch it confirm.',
    href: '/app/payment-sessions',
  },
  {
    n: 4,
    t: 'Wire a webhook',
    d: 'Add an HTTPS endpoint and send a test event to verify your handler.',
    href: '/app/webhooks',
  },
] as const

/**
 * Dashboard home.
 *
 * Pulls four queries in parallel — merchant profile, MRR, recent
 * payment sessions, active subscriptions — and renders KPI cards from
 * the projections. Each card links to the matching detail surface.
 *
 * The "Get started" checklist is shown until the merchant has at least
 * one confirmed session; after that it collapses into a smaller banner.
 */
export default function DashboardHome() {
  const merchantQuery = useMerchantMe()
  const mrrQuery = useMrr()
  const sessionsQuery = usePaymentSessions({ limit: 100 })
  const subsQuery = useSubscriptions({ status: 'active', limit: 100 })
  const invoicesQuery = useInvoices({ limit: 100 })

  // Derive metrics from the live queries.
  const stats = React.useMemo(() => {
    const now = Date.now()
    const sevenDays = 7 * 86_400_000

    const sessions = sessionsQuery.data?.data ?? []
    const confirmed7d = sessions.filter(
      (s) => s.status === 'confirmed' && now - +new Date(s.updatedAt) < sevenDays,
    )
    const volume7d = confirmed7d.reduce((s, row) => s + tokenAmountToNumber(row.amount), 0)

    const invoices = invoicesQuery.data?.data ?? []
    const openInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue')

    return {
      volume7d,
      confirmedCount7d: confirmed7d.length,
      activeSubsCount: subsQuery.data?.data.length ?? 0,
      openInvoiceCount: openInvoices.length,
      anyConfirmedAtAll: sessions.some((s) => s.status === 'confirmed'),
    }
  }, [sessionsQuery.data, subsQuery.data, invoicesQuery.data])

  const merchant = merchantQuery.data
  const showGettingStarted = !stats.anyConfirmedAtAll

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
      value: stats.activeSubsCount.toLocaleString(),
      icon: Users,
      href: '/app/subscriptions',
      subtle: 'Customers cycling',
    },
    {
      label: '7-day volume',
      value: stats.volume7d.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' USDC',
      icon: CreditCard,
      href: '/app/payment-sessions',
      subtle: `${stats.confirmedCount7d} confirmed`,
    },
    {
      label: 'Open invoices',
      value: stats.openInvoiceCount.toString(),
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
        description="What's happening across your billing surface."
      />

      <motion.div
        {...inViewOnce}
        variants={stagger(0.04, 0.06)}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {KPIS.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {showGettingStarted ? (
          <Card className="shadow-sub-card border-border/60 lg:col-span-2">
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
              <div className="space-y-3">
                {STEPS.map((s) => (
                  <Link
                    key={s.n}
                    href={s.href}
                    className="border-border/60 bg-background group flex items-center gap-4 rounded-lg border p-4 transition-all hover:border-[#02C76A]/40 hover:shadow-sm"
                  >
                    <div className="font-sora flex size-8 shrink-0 items-center justify-center rounded-full bg-[#02C76A]/10 text-sm font-semibold text-[#02C76A]">
                      {s.n}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{s.t}</div>
                      <div className="text-muted-foreground text-xs">{s.d}</div>
                    </div>
                    <ArrowUpRight className="text-muted-foreground/40 group-hover:text-foreground size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <RecentSessionsCard />
        )}

        <Card className="shadow-sub-card border-border/60">
          <CardContent className="p-6">
            <h3 className="font-poppins font-semibold">Live mode readiness</h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Complete these to issue live API keys.
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <ReadinessItem
                label="Verify your email"
                done={merchant ? Boolean(merchant.email) : false}
              />
              <ReadinessItem label="Enable two-factor auth" done={true} note="Managed by Privy" />
              <ReadinessItem
                label="Complete business onboarding"
                done={merchant ? Boolean(merchant.businessName) : false}
              />
              <ReadinessItem
                label="Set a payout wallet address"
                done={merchant ? Boolean(merchant.payoutAddress) : false}
              />
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

function ReadinessItem({ label, done, note }: { label: string; done: boolean; note?: string }) {
  return (
    <li className="flex items-start gap-2">
      <div
        className={[
          'mt-2 size-1.5 rounded-full',
          done ? 'bg-[#02C76A]' : 'bg-muted-foreground/40',
        ].join(' ')}
      />
      <div className="flex-1">
        <div className={done ? 'text-foreground' : ''}>{label}</div>
        {note ? <div className="text-muted-foreground text-xs">{note}</div> : null}
      </div>
    </li>
  )
}

/**
 * Once the merchant has at least one confirmed session, the
 * getting-started checklist collapses and the dashboard surfaces
 * a recent-activity card in its place. We render the most recent
 * five confirmed sessions for at-a-glance "did things happen today".
 */
function RecentSessionsCard() {
  const { data, isLoading } = usePaymentSessions(
    { status: 'confirmed', limit: 5 },
    {
      select: (page) => page.data,
    },
  )

  return (
    <Card className="shadow-sub-card border-border/60 lg:col-span-2">
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
