'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { InteractiveHoverButton } from '@/components/effects/interactive-hover-button'
import { Glyph } from '@/components/shared/logo'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'

/**
 * Final marketing CTA — `#050020` background, animated halo around the
 * Strimz glyph (mimics the prior CTA's pulsing-circle pattern), big
 * type. The InteractiveHoverButton lands the brand signature here too.
 */
export function ClosingCta() {
  return (
    <section className="relative overflow-hidden bg-[#050020] py-24 text-white">
      <div className="absolute inset-0 strimz-aurora opacity-50" aria-hidden />
      <div className="absolute inset-x-0 -bottom-20 flex justify-center" aria-hidden>
        <div className="size-[640px] rounded-full bg-[#02C76A]/20 blur-[120px]" />
      </div>

      <motion.div
        {...inViewOnce}
        variants={stagger(0.05, 0.08)}
        className="relative mx-auto max-w-4xl px-4 text-center sm:px-6"
      >
        <motion.h2
          variants={fadeUp}
          className="text-balance text-4xl font-bold tracking-tight sm:text-6xl"
        >
          Stop building billing.
          <br />
          <span className="text-white/60">Start shipping product.</span>
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mx-auto mt-6 max-w-xl text-balance text-white/70"
        >
          Your free Strimz account ships with everything. Live mode unlocks once you complete
          identity verification — usually under 5 minutes.
        </motion.p>
        <motion.div variants={fadeUp} className="mt-10 flex justify-center gap-3">
          <InteractiveHoverButton
            type="button"
            icon={<ArrowRight className="size-4" />}
            innerClassName="bg-white rounded-md"
            className="strimz-cta-shadow flex h-12 w-[180px] items-center justify-center rounded-md bg-[#02C76A] font-poppins text-sm font-medium text-white hover:text-[#050020]"
            onClick={() => (window.location.href = '/signup')}
          >
            Get your API keys
          </InteractiveHoverButton>
          <a
            href="/contact"
            className="inline-flex h-12 items-center rounded-md border border-white/20 bg-white/5 px-6 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/10"
          >
            Talk to sales
          </a>
        </motion.div>

        <motion.div variants={fadeUp} className="relative mx-auto mt-20 inline-flex">
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[#02C76A]/30" />
          <div className="strimz-logo-shadow relative flex size-20 items-center justify-center rounded-full bg-[#02C76A]">
            <Glyph className="size-10 [&>defs>linearGradient>stop]:!stop-color-white" />
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
