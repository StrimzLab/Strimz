'use client'

import { motion } from 'framer-motion'
import { Check, Repeat, Wallet } from 'lucide-react'

/**
 * Stylised Strimz dashboard preview shown in the marketing hero. Tells
 * the recurring-billing story in one frame:
 *   - one prominent active subscription card with `next charge` countdown
 *   - a 7-charge history strip showing the customer signed *once* and
 *     has been charged *seven times*
 *   - a floating `subscription.charged` webhook chip
 *   - a payout pill confirming USDC landed in the merchant wallet
 *
 * Mock-only — no real data. Replace with a screenshot of `/app` once
 * dashboard polish lands and we have realistic seed data.
 */
export function DashboardPreview() {
  return (
    <div className="relative w-full max-w-[560px]">
      {/* Soft brand halo behind the card */}
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[28px] bg-gradient-to-br from-[#02C76A]/25 via-[#02C76A]/5 to-transparent blur-3xl"
      />

      {/* Browser chrome shell */}
      <div className="relative overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white shadow-[0_30px_60px_-15px_rgba(5,0,32,0.18)]">
        <div className="flex items-center gap-2 border-b border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 sm:px-4 sm:py-3">
          <span className="size-2.5 rounded-full bg-[#FF5F57]" />
          <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="size-2.5 rounded-full bg-[#28C840]" />
          <div className="ml-2 flex-1 truncate rounded-md bg-white px-3 py-1 font-mono text-[10px] text-[#58556A] ring-1 ring-black/5 sm:ml-3 sm:text-[11px]">
            app.strimz.finance/app/subscriptions
          </div>
        </div>

        {/* Page header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Repeat className="size-4 text-[#02C76A]" />
            <h3 className="font-sora text-[13px] font-[600] text-[#050020] sm:text-[14px]">
              Subscriptions
            </h3>
            <span className="rounded-full bg-[#02C76A]/10 px-2 py-0.5 font-poppins text-[10px] font-[500] text-[#02C76A] sm:text-[11px]">
              12 active
            </span>
          </div>
          <span className="hidden font-poppins text-[11px] text-[#58556A] sm:inline">Live</span>
        </div>

        {/* The hero subscription card */}
        <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
          <div className="rounded-[10px] border border-[#02C76A]/30 bg-gradient-to-br from-[#02C76A]/5 to-white p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <code className="font-mono text-[10px] text-[#58556A] sm:text-[11px]">0x3f4a…a2d1</code>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-sora text-[15px] font-[700] text-[#050020] sm:text-[16px]">
                    Pro
                  </span>
                  <span className="font-mono text-[13px] font-[500] text-[#050020] sm:text-[14px]">
                    $20.00 USDC
                  </span>
                  <span className="font-poppins text-[10px] text-[#58556A] sm:text-[11px]">
                    /month
                  </span>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#02C76A]/10 px-2 py-1 font-poppins text-[10px] font-[500] text-[#02C76A] sm:px-2.5 sm:text-[11px]">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#02C76A]/70" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-[#02C76A]" />
                </span>
                active
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-[#02C76A]/15 pt-3">
              <span className="font-poppins text-[10px] text-[#58556A] sm:text-[11px]">
                Next charge
              </span>
              <span className="font-mono text-[10px] font-[600] text-[#050020] sm:text-[11px]">
                in 2d · 4h · 12m
              </span>
            </div>
          </div>

          {/* Charge history strip */}
          <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] p-3.5 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="font-poppins text-[10px] font-[600] uppercase tracking-wider text-[#58556A] sm:text-[11px]">
                Last 7 charges
              </span>
              <span className="font-poppins text-[10px] text-[#02C76A] sm:text-[11px]">
                all confirmed
              </span>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1 sm:gap-1.5">
              {['May 2', 'Apr 2', 'Mar 2', 'Feb 2', 'Jan 2', 'Dec 2', 'Nov 2'].map((d) => (
                <div
                  key={d}
                  className="flex flex-col items-center gap-1 rounded-md bg-white p-1.5 ring-1 ring-[#E5E7EB] sm:p-2"
                >
                  <Check className="size-3 text-[#02C76A]" strokeWidth={3} />
                  <span className="font-mono text-[8px] text-[#58556A] sm:text-[9px]">{d}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 font-poppins text-[10px] text-[#58556A] sm:text-[11px]">
              Customer signed{' '}
              <span className="font-[600] text-[#050020]">once on April 2</span> · charged{' '}
              <span className="font-[600] text-[#02C76A]">7 times</span>
            </p>
          </div>
        </div>
      </div>

      {/* Floating chip — webhook delivered */}
      <motion.div
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 220, damping: 18 }}
        className="absolute -top-4 right-2 hidden items-center gap-2 rounded-full bg-white px-3 py-2 shadow-[0_15px_30px_-10px_rgba(5,0,32,0.25)] ring-1 ring-black/5 sm:flex md:right-4"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#02C76A]/60" />
          <span className="relative inline-flex size-2 rounded-full bg-[#02C76A]" />
        </span>
        <code className="font-mono text-[10px] font-[500] text-[#050020] md:text-[11px]">
          subscription.charged
        </code>
        <span className="font-poppins text-[9px] text-[#58556A] md:text-[10px]">· 84ms</span>
      </motion.div>

      {/* Floating chip — payout landed */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.9, type: 'spring', stiffness: 220, damping: 18 }}
        className="absolute -bottom-4 left-2 hidden items-center gap-2 rounded-full bg-[#050020] px-3 py-2 shadow-[0_15px_30px_-10px_rgba(5,0,32,0.4)] sm:flex md:left-4"
      >
        <Wallet className="size-3.5 text-[#02C76A]" />
        <span className="font-mono text-[10px] font-[500] text-white md:text-[11px]">
          +$20.00 USDC
        </span>
        <span className="font-poppins text-[9px] text-white/60 md:text-[10px]">→ payout wallet</span>
      </motion.div>
    </div>
  )
}
