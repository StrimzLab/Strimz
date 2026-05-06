'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { InteractiveHoverButton } from '@/components/effects/interactive-hover-button'
import { fadeUp, stagger } from '@/lib/motion'
import { DashboardPreview } from './dashboard-preview'

/**
 * Marketing hero — text-on-left + product preview on right at lg+,
 * stacks to a single column on mobile/tablet. The product preview is
 * the visual centrepiece (not a generic logo orb): it sells Strimz's
 * USP — recurring stablecoin billing — in one frame.
 */
export function Hero() {
  const router = useRouter()
  return (
    <section className="relative w-full overflow-hidden bg-white">
      {/* Soft brand backdrop — wave gradient blobs that mirror
       * strimz-subscription's hero waves but as ambient backdrops
       * instead of orb foreground. */}
      <div
        aria-hidden
        className="strimz-wave-1 pointer-events-none absolute -right-20 -top-32 h-[480px] w-[480px] rounded-full opacity-60 blur-3xl"
      />
      <div
        aria-hidden
        className="strimz-wave-2 pointer-events-none absolute -bottom-20 -left-20 h-[420px] w-[420px] rounded-full opacity-50 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14 md:px-8 md:pb-20 md:pt-16 lg:px-16 lg:pb-28 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          {/* ─── Text column ─── */}
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger(0.06, 0.1)}
            className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:max-w-none lg:text-left"
          >
            <motion.h1
              variants={fadeUp}
              className="font-sora mt-5 text-[40px] font-[700] leading-[1.04] tracking-[-0.025em] text-[#050020] sm:text-[52px] md:text-[60px] lg:text-[60px] xl:text-[68px]"
            >
              The billing layer
              <br />
              for <span className="text-[#02C76A]">stablecoins</span>.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="font-poppins mx-auto mt-5 max-w-lg text-base font-[400] leading-[28px] text-[#58556A] md:text-[17px] lg:mx-0"
            >
              One API for one-time payments and recurring subscriptions. Your customer signs once.
              You charge them every period. They don&apos;t pay gas. Your USDC arrives in seconds.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            >
              <InteractiveHoverButton
                type="button"
                icon={<ArrowRight className="h-5 w-5" />}
                innerClassName="bg-[#02C76A] rounded-[8px]"
                className="font-poppins shadow-cta flex h-[52px] cursor-pointer items-center justify-center rounded-[8px] bg-[#02C76A] px-7 text-[15px] font-[600] text-white hover:text-white"
                onClick={() => router.push('/signup')}
              >
                Start building
              </InteractiveHoverButton>
              <Link
                href="/docs"
                target="_blank"
                rel="noreferrer"
                className="font-poppins inline-flex h-[52px] items-center rounded-[8px] border border-[#E5E7EB] bg-white px-6 text-[15px] font-[500] text-[#050020] transition-colors hover:border-[#050020]"
              >
                Read the docs
              </Link>
            </motion.div>

            <motion.p variants={fadeUp} className="font-poppins mt-6 text-[13px] text-[#58556A]">
              Free to start · No credit card · Settled in USDC
            </motion.p>
          </motion.div>

          {/* ─── Product preview column ─── */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            className="flex justify-center lg:justify-end"
          >
            <DashboardPreview />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
