'use client'

import { motion } from 'framer-motion'
import { Wallet, Boxes, Database, Webhook } from 'lucide-react'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'

const STEPS = [
  {
    icon: Wallet,
    label: '01 · Sign',
    title: 'Customer signs once',
    body: 'Your customer connects a wallet (Privy or Reown both work) and signs one transaction. That signature lets you charge them on the schedule you set.',
    accent: 'bg-[#02C76A]/10 text-[#02C76A]',
  },
  {
    icon: Boxes,
    label: '02 · Charge',
    title: 'Contract pulls USDC',
    body: 'When a charge is due, our scheduler calls the contract. Each attempt has a unique ID derived from the subscription and period, so retries can never double-charge.',
    accent: 'bg-[#0969da]/10 text-[#0969da]',
  },
  {
    icon: Database,
    label: '03 · Index',
    title: 'Indexer projects',
    body: 'A Go process watches Arc and writes every event into your Postgres. If our database ever drifts, you can rebuild it from chain history. The contract is the source of truth.',
    accent: 'bg-[#8250df]/10 text-[#8250df]',
  },
  {
    icon: Webhook,
    label: '04 · Notify',
    title: 'Webhook fires',
    body: 'We POST the event to your endpoint with an HMAC-SHA256 signature. Failed deliveries retry on a backoff. The signature includes a timestamp, so an attacker can’t replay old events.',
    accent: 'bg-[#cf222e]/10 text-[#cf222e]',
  },
] as const

/**
 * "How it works" — 4-step horizontal flow on desktop, vertical stack
 * on mobile. SVG dashed connector lines with travelling pulse dots
 * between cards (desktop only) communicate the request flowing through
 * the system.
 */
export function HowItWorks() {
  return (
    <section className="relative w-full overflow-hidden bg-[#F9FAFB] px-4 py-20 md:px-6 lg:py-24">
      <motion.div
        {...inViewOnce}
        variants={stagger(0.05, 0.1)}
        className="mx-auto max-w-[760px] text-center"
      >
        <motion.span
          variants={fadeUp}
          className="font-poppins shadow-sub-card inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-[600] text-[#050020] ring-1 ring-black/5"
        >
          <span className="size-1.5 rounded-full bg-[#02C76A]" />
          How it works
        </motion.span>
        <motion.h2
          variants={fadeUp}
          className="font-sora mt-5 text-[32px] font-[700] leading-[1.06] tracking-[-0.02em] text-[#050020] md:text-[44px] lg:text-[48px]"
        >
          From signature to webhook
          <br className="hidden sm:inline" /> in about{' '}
          <span className="text-[#02C76A]">20 seconds</span>.
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="font-poppins mt-4 text-base font-[400] leading-[28px] text-[#58556A]"
        >
          Four steps, end to end. No three-day wait. No chargeback window. The on-chain hash is the
          receipt.
        </motion.p>
      </motion.div>

      {/* Steps grid — cards stand alone; the small inter-card gap is
       * the visual rhythm. No decorative connector line. */}
      <motion.div
        {...inViewOnce}
        variants={stagger(0.06, 0.08)}
        className="mx-auto mt-14 grid max-w-[1200px] gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {STEPS.map((step) => (
          <motion.article
            key={step.label}
            variants={fadeUp}
            className="shadow-sub-card relative flex flex-col rounded-[16px] border border-[#E5E7EB] bg-white p-6 transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span
                className={[
                  'shadow-sub-icon flex size-12 items-center justify-center rounded-[12px]',
                  step.accent,
                ].join(' ')}
              >
                <step.icon className="size-5" />
              </span>
              <span className="font-mono text-[10px] font-[500] uppercase tracking-[0.18em] text-[#58556A]">
                {step.label}
              </span>
            </div>
            <h3 className="font-sora mt-5 text-[18px] font-[700] leading-[24px] text-[#050020]">
              {step.title}
            </h3>
            <p className="font-poppins mt-2 text-[13px] leading-[22px] text-[#58556A]">
              {step.body}
            </p>
          </motion.article>
        ))}
      </motion.div>
    </section>
  )
}
