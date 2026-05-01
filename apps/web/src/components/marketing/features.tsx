'use client'

import { motion } from 'framer-motion'
import {
  Bot,
  CreditCard,
  Globe2,
  LineChart,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'

const FEATURES = [
  {
    icon: CreditCard,
    title: 'One-shot payments',
    body: 'Hosted checkout, webhook on settlement, idempotent on every retry. Drop-in for any product.',
  },
  {
    icon: Wallet,
    title: 'Pull-based subscriptions',
    body: 'Customer signs once. The scheduler charges atomically every period. No re-prompts.',
  },
  {
    icon: ShieldCheck,
    title: 'Refunds + dispute trail',
    body: 'Server-side intent + wallet-signed transfer. Indexer reconciles on-chain status automatically.',
  },
  {
    icon: Globe2,
    title: 'Cross-chain settlement',
    body: 'Customer pays from any USDC chain. CCTP V2 routes the bridge; you get USDC on Arc.',
  },
  {
    icon: Bot,
    title: 'AI AutoPay Agent',
    body: 'Recovery emails, cashflow anomaly detection, monthly digests, vendor spend caps — included.',
  },
  {
    icon: LineChart,
    title: 'Real-time analytics',
    body: 'Conversion, churn, MRR, LTV, and a 90-day forecast. SQL-backed, no third-party pipeline.',
  },
] as const

export function Features() {
  return (
    <section className="bg-[#050020] py-24 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          {...inViewOnce}
          variants={stagger(0.05, 0.1)}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.h2
            variants={fadeUp}
            className="text-balance text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Everything billing teams ship — already shipped.
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-balance text-white/70">
            Stripe-grade primitives, settled in USDC on Arc, with on-chain idempotency and an audit
            trail you can independently verify.
          </motion.p>
        </motion.div>

        <motion.div
          {...inViewOnce}
          variants={stagger(0.08, 0.06)}
          className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm transition-colors hover:border-[#02C76A]/40"
            >
              <div className="strimz-sub-icon-shadow mb-5 inline-flex size-11 items-center justify-center rounded-lg bg-[#02C76A]/15 text-[#02C76A]">
                <f.icon className="size-5" />
              </div>
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{f.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
