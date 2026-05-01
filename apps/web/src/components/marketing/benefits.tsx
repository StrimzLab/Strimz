'use client'

import { motion } from 'framer-motion'
import { ArrowRight, BarChart2, Repeat, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@strimz/ui'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'

/**
 * Three-card "benefits" section — one for the merchant flow we lean
 * hardest into (subscriptions), one developer-facing (refunds + audit),
 * one quantitative (analytics). Cards are the largest atomic unit of
 * marketing real-estate; every detail (header chip, big mock, body
 * copy, link) is choreographed via framer.
 */
const BLOCKS = [
  {
    chip: 'Subscriptions',
    Icon: Repeat,
    title: 'Recurring revenue, on stablecoins.',
    body:
      "Customers approve once on-chain. Strimz's scheduler atomically charges every period with a deterministic chargeAttemptId so retries are safe by construction. Built for $20/mo SaaS up to $50k/quarter enterprise contracts.",
    bullets: [
      'Atomic batch charging — gas-efficient at scale',
      'Configurable grace window per merchant (24/48/72h)',
      'Auto-recovery via the AutoPay Agent',
      'Customer cancels in their wallet; we project on-chain',
    ],
    mock: <SubscriptionMock />,
    href: '/docs/api-reference#subscriptions',
    cta: 'Subscriptions API →',
  },
  {
    chip: 'Refunds',
    Icon: ShieldCheck,
    title: 'Refunds with a clean audit trail.',
    body:
      'Server-side intent, wallet-signed transfer, indexer reconciles on-chain status. Every refund has a tx hash and a deterministic state machine — no support ticket guesswork.',
    bullets: [
      'Cumulative refund cap enforced at insert time',
      'Wallet-signing instructions returned in the create response',
      'Webhook fires on `refund.completed` with the on-chain hash',
      'Full state visible in the dashboard timeline',
    ],
    mock: <RefundMock />,
    href: '/docs/api-reference#refunds',
    cta: 'Refunds API →',
  },
  {
    chip: 'Analytics',
    Icon: BarChart2,
    title: 'Forecast, not just dashboards.',
    body:
      "Conversion, churn, MRR, LTV, and a 90-day linear-regression forecast — all SQL-backed against your own Postgres. The same queries the AutoPay Agent uses for monthly merchant insights.",
    bullets: [
      'Daily conversion rate per session created',
      'Trailing-12-month average churn',
      'Interval-normalised MRR (daily/weekly/monthly/yearly)',
      'Forecast confidence: low / medium / high (sample size)',
    ],
    mock: <ForecastMock />,
    href: '/docs/api-reference#analytics',
    cta: 'Analytics API →',
  },
] as const

export function Benefits() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <motion.div {...inViewOnce} variants={stagger(0.05, 0.1)} className="mx-auto max-w-2xl text-center">
        <motion.h2
          variants={fadeUp}
          className="text-balance text-3xl font-bold tracking-tight sm:text-5xl"
        >
          Every billing primitive — ready to wire.
        </motion.h2>
        <motion.p variants={fadeUp} className="mt-4 text-muted-foreground">
          Pick a primitive, copy the snippet, ship the feature. We handle on-chain idempotency,
          retries, and reconciliation.
        </motion.p>
      </motion.div>

      <div className="mt-16 space-y-16">
        {BLOCKS.map((b, i) => (
          <motion.div
            key={b.title}
            {...inViewOnce}
            variants={fadeUp}
            className="grid items-center gap-12 lg:grid-cols-2"
          >
            <div className={i % 2 === 1 ? 'lg:order-2' : undefined}>
              <Badge className="mb-4 inline-flex items-center gap-1.5 bg-[#02C76A]/10 font-medium text-[#02C76A] hover:bg-[#02C76A]/15">
                <b.Icon className="size-3.5" />
                {b.chip}
              </Badge>
              <h3 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{b.title}</h3>
              <p className="mt-4 text-muted-foreground">{b.body}</p>
              <ul className="mt-6 space-y-3 text-sm">
                {b.bullets.map((bu) => (
                  <li key={bu} className="flex items-start gap-2">
                    <div className="mt-2 size-1.5 shrink-0 rounded-full bg-[#02C76A]" />
                    <span>{bu}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={b.href}
                className="group mt-8 inline-flex items-center gap-1 text-sm font-medium text-[#02C76A]"
              >
                {b.cta}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className={i % 2 === 1 ? 'lg:order-1' : undefined}>{b.mock}</div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ───────────── Mocks ─────────────

function MockShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-[#02C76A]/20 via-transparent to-transparent blur-xl" />
      <div className="strimz-card-shadow relative overflow-hidden rounded-xl border border-border/60 bg-background/95 p-5">
        {children}
      </div>
    </div>
  )
}

function SubscriptionMock() {
  return (
    <MockShell>
      <pre className="overflow-x-auto text-sm leading-relaxed">
        <code>{`POST /v1/subscription-plans
{
  "name": "Pro",
  "amount": "20000000",
  "currency": "USDC",
  "interval": "monthly",
  "intervalCount": 1,
  "trialPeriodDays": 14
}

→ 201 Created
{
  "id": "plan_pro_monthly",
  "checkoutUrl": "https://strimz.io/sub/plan_pro_monthly"
}`}</code>
      </pre>
    </MockShell>
  )
}

function RefundMock() {
  return (
    <MockShell>
      <div className="space-y-3">
        <RefundLifecycleStep n={1} status="awaiting_signature" label="Refund created" />
        <RefundLifecycleStep n={2} status="submitted" label="Tx hash recorded" />
        <RefundLifecycleStep n={3} status="completed" label="Indexer confirmed" active />
      </div>
    </MockShell>
  )
}

function RefundLifecycleStep({
  n,
  status,
  label,
  active,
}: {
  n: number
  status: string
  label: string
  active?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <span
        className={`flex size-7 items-center justify-center rounded-full text-xs font-medium ${
          active ? 'bg-[#02C76A] text-white' : 'bg-muted text-muted-foreground'
        }`}
      >
        {n}
      </span>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="font-mono text-xs text-muted-foreground">status: {status}</div>
      </div>
      {active && (
        <span className="rounded-full bg-[#02C76A]/10 px-2 py-0.5 text-xs font-medium text-[#02C76A]">
          live
        </span>
      )}
    </div>
  )
}

function ForecastMock() {
  return (
    <MockShell>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'MRR', value: '$48,250' },
          { label: 'Churn (12m)', value: '4.1%' },
          { label: 'Forecast 90d', value: '+18%' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{kpi.label}</div>
            <div className="mt-1 font-mono text-lg font-semibold">{kpi.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 h-32 rounded-lg bg-gradient-to-br from-[#02C76A]/30 via-[#02C76A]/10 to-transparent">
        <svg viewBox="0 0 240 80" className="h-full w-full" preserveAspectRatio="none">
          <path
            d="M 0 65 Q 30 60, 60 50 T 120 32 T 200 18 L 200 80 L 0 80 Z"
            fill="url(#fgrad)"
          />
          <path
            d="M 0 65 Q 30 60, 60 50 T 120 32 T 200 18"
            stroke="#02C76A"
            strokeWidth="2"
            fill="none"
          />
          <defs>
            <linearGradient id="fgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#02C76A" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#02C76A" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </MockShell>
  )
}
