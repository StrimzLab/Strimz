'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Check, ExternalLink } from 'lucide-react'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'
import { CodeBlock } from '@/components/shared/code-block'

const BLOCKS = [
  {
    chip: 'Subscriptions',
    title: 'Recurring revenue, on stablecoins.',
    body:
      'Your customer signs once. After that, the scheduler runs every period and pulls the next charge. Each attempt has a deterministic ID, so a flaky scheduler can’t double-charge anyone.',
    bullets: [
      'Batch charges so gas stays cheap at scale',
      'Pick your grace window: 24, 48, or 72 hours',
      'The AutoPay Agent emails customers on failed charges',
      'Customers can cancel in their wallet; we project the change on-chain',
    ],
    href: '/docs/api/subscriptions',
    cta: 'Subscriptions API',
    mock: <SubscriptionMock />,
  },
  {
    chip: 'Refunds',
    title: 'Refunds with a real audit trail.',
    body:
      'You create the intent on the server. The merchant signs the transfer from their own wallet. The indexer watches Arc and updates the refund the moment the transfer confirms. Every refund has a tx hash you can verify yourself.',
    bullets: [
      'You can’t refund more than the original transaction (we check at insert time)',
      'The create response includes the wallet-signing instructions',
      '`refund.completed` webhook fires with the on-chain tx hash',
      'Full state machine visible in the dashboard timeline',
    ],
    href: '/docs/api/refunds',
    cta: 'Refunds API',
    mock: <RefundMock />,
  },
  {
    chip: 'Analytics',
    title: 'Forecasts, not just dashboards.',
    body:
      'Conversion, churn, MRR, LTV, and a 90-day forecast. Every metric runs as SQL against your own Postgres — the AutoPay Agent uses the same queries to put together its monthly summary.',
    bullets: [
      'Daily conversion rate per session created',
      '12-month trailing churn',
      'MRR normalised across daily, weekly, monthly, and yearly plans',
      'Forecast confidence rated low, medium, or high',
    ],
    href: '/docs/api/analytics',
    cta: 'Analytics API',
    mock: <ForecastMock />,
  },
] as const

/**
 * Three benefit blocks, alternating layout. Tightened padding + denser
 * mocks so each side actually fills its column rather than leaving
 * negative space when one side is shorter than the other.
 */
export function Benefits() {
  return (
    <section className="w-full bg-white px-4 py-20 md:px-6 lg:py-28">
      <motion.div
        {...inViewOnce}
        variants={stagger(0.05, 0.1)}
        className="mx-auto flex max-w-[760px] flex-col items-center text-center"
      >
        <motion.h2
          variants={fadeUp}
          className="font-sora text-[32px] font-[700] leading-[40px] text-[#050020] md:text-[40px] md:leading-[48px]"
        >
          The billing primitives, already built.
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-4 max-w-[488px] font-poppins text-base font-[400] text-[#58556A]"
        >
          Pick what you need, copy the snippet, ship the feature. We deal with retries and
          reconciliation; the contracts handle idempotency.
        </motion.p>
      </motion.div>

      <div className="mx-auto mt-12 grid max-w-[1200px] gap-5">
        {BLOCKS.map((b, i) => (
          <motion.article
            key={b.chip}
            {...inViewOnce}
            variants={fadeUp}
            className="grid items-stretch gap-0 overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-[#F9FAFB] md:grid-cols-2"
          >
            {/* Text side */}
            <div
              className={[
                'flex flex-col justify-center px-6 py-10 md:px-10 md:py-12 lg:px-12 lg:py-14',
                i % 2 === 1 ? 'md:order-2' : '',
              ].join(' ')}
            >
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#02C76A]/10 px-3 py-1 font-poppins text-[12px] font-[500] text-[#02C76A]">
                <span className="size-1.5 rounded-full bg-[#02C76A]" />
                {b.chip}
              </span>
              <h3 className="mt-4 font-sora text-[24px] font-[700] leading-[32px] text-[#050020] md:text-[30px] md:leading-[38px]">
                {b.title}
              </h3>
              <p className="mt-3 font-poppins text-[15px] font-[400] leading-[26px] text-[#58556A]">
                {b.body}
              </p>
              <ul className="mt-5 space-y-2.5 font-poppins text-[14px] text-[#050020]">
                {b.bullets.map((bu) => (
                  <li key={bu} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#02C76A]" />
                    <span>{bu}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={b.href}
                className="group mt-6 inline-flex w-fit items-center gap-1 font-poppins text-sm font-[500] text-[#02C76A]"
              >
                {b.cta}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Mock side — fills the cell, no negative space */}
            <div
              className={[
                'relative flex items-stretch overflow-hidden bg-gradient-to-br from-[#02C76A]/8 via-[#F9FAFB] to-[#F9FAFB] p-6 md:p-8 lg:p-10',
                i % 2 === 1 ? 'md:order-1' : '',
              ].join(' ')}
            >
              {b.mock}
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  )
}

// ───────────── Mocks ─────────────

function MockShell({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="relative flex w-full flex-col">
      <div className="absolute -inset-4 rounded-[20px] bg-gradient-to-br from-[#02C76A]/15 via-transparent to-transparent blur-2xl" aria-hidden />
      <div className="relative flex w-full flex-col overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white shadow-sub-card">
        {label ? (
          <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#02C76A]" />
              <code className="font-mono text-[11px] text-[#58556A]">{label}</code>
            </span>
            <span className="rounded-full bg-[#02C76A]/10 px-2 py-0.5 font-poppins text-[10px] font-[500] text-[#02C76A]">
              200 OK · 84ms
            </span>
          </div>
        ) : null}
        <div className="flex-1 p-5">{children}</div>
      </div>
    </div>
  )
}

const SUBSCRIPTION_REQUEST = `{
  "name": "Pro",
  "amount": "20000000",
  "currency": "USDC",
  "interval": "monthly",
  "intervalCount": 1,
  "trialPeriodDays": 14
}`

const SUBSCRIPTION_RESPONSE = `// 201 Created
{
  "id": "plan_pro_monthly",
  "checkoutUrl": "https://strimz.finance/sub/plan_pro_monthly",
  "activeSubscribers": 0,
  "createdAt": "2026-05-01T12:00:00Z"
}`

function SubscriptionMock() {
  return (
    <MockShell label="POST /v1/subscription-plans">
      <CodeBlock code={SUBSCRIPTION_REQUEST} language="json" tone="light" />
      <div className="mt-3 border-t border-[#E5E7EB] pt-3">
        <CodeBlock code={SUBSCRIPTION_RESPONSE} language="js" tone="light" />
      </div>
    </MockShell>
  )
}

function RefundMock() {
  return (
    <MockShell label="rf_x4f8b9d2c1a">
      <div className="space-y-2.5">
        <RefundStep n={1} status="awaiting_signature" label="Refund created" time="2m ago" />
        <RefundStep n={2} status="submitted" label="Tx hash recorded" time="1m ago" />
        <RefundStep n={3} status="completed" label="Indexer confirmed" time="just now" active />
      </div>
      <div className="mt-4 flex items-center justify-between rounded-[8px] border border-[#02C76A]/20 bg-[#02C76A]/5 px-3 py-2.5">
        <div>
          <div className="font-mono text-[11px] text-[#58556A]">refund.completed</div>
          <div className="font-poppins text-[12px] font-[500] text-[#050020]">webhook delivered</div>
        </div>
        <ExternalLink className="size-3.5 text-[#02C76A]" />
      </div>
    </MockShell>
  )
}

function RefundStep({
  n,
  status,
  label,
  time,
  active,
}: {
  n: number
  status: string
  label: string
  time: string
  active?: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] p-2.5">
      <span
        className={[
          'flex size-7 shrink-0 items-center justify-center rounded-full font-poppins text-xs font-[600]',
          active ? 'bg-[#02C76A] text-white shadow-sub-icon' : 'bg-white text-[#58556A]',
        ].join(' ')}
      >
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-poppins text-[13px] font-[500] text-[#050020]">{label}</div>
        <div className="font-mono text-[10px] text-[#58556A]">{status}</div>
      </div>
      <span className="font-poppins text-[10px] text-[#58556A]">{time}</span>
    </div>
  )
}

function ForecastMock() {
  return (
    <MockShell label="GET /v1/stats/forecast">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'MRR', value: '$48,250', delta: '+12%' },
          { label: 'Churn 12m', value: '4.1%', delta: '-0.4pt' },
          { label: '90d', value: '+18%', delta: 'high' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] p-2.5">
            <div className="font-poppins text-[10px] uppercase tracking-wider text-[#58556A]">
              {kpi.label}
            </div>
            <div className="mt-0.5 font-sora text-[15px] font-[700] text-[#050020]">
              {kpi.value}
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-[#02C76A]">{kpi.delta}</div>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 240 80" className="mt-3 h-24 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="fgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#02C76A" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#02C76A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M 0 65 Q 30 60, 60 50 T 120 32 T 200 18 L 240 12 L 240 80 L 0 80 Z" fill="url(#fgrad)" />
        <path d="M 0 65 Q 30 60, 60 50 T 120 32 T 200 18 L 240 12" stroke="#02C76A" strokeWidth="2" fill="none" />
        <circle cx="240" cy="12" r="3" fill="#02C76A" />
      </svg>
      <div className="mt-2 flex items-center justify-between font-poppins text-[10px] text-[#58556A]">
        <span>last 90 days</span>
        <span className="text-[#02C76A]">forecast: high confidence</span>
      </div>
    </MockShell>
  )
}
