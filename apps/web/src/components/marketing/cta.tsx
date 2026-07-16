'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { MoveRight } from 'lucide-react'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'
import { InteractiveHoverButton } from '@/components/effects/interactive-hover-button'
import strimzVector from '@/../public/logoIcons/StrimzVector.svg'
import ctaPattern from '@/../public/patterns/ctaPattern.svg'

/**
 * Closing CTA. Direct port of strimz-subscription's `CTA` section.
 * `bg-primary` block with the cta-pattern strip pulsing along the bottom
 * and the Strimz vector pulsing on top of it.
 */
export function ClosingCta() {
  const router = useRouter()
  return (
    <section className="w-full bg-[#050020] py-16 md:py-20">
      <motion.div
        {...inViewOnce}
        variants={stagger(0.05, 0.1)}
        className="mx-auto flex w-full max-w-[812px] flex-col items-center gap-4 px-6 lg:px-0"
      >
        <motion.h2
          variants={fadeUp}
          className="font-sora text-balance text-center text-[40px] font-[700] leading-[48px] text-white md:text-[60px] md:leading-[68px]"
        >
          Stop writing billing code.
          <br />
          <span className="text-white/60">Build the rest of the app.</span>
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="font-poppins max-w-[522px] text-balance text-center text-base font-[400] leading-[28px] text-white"
        >
          The free plan includes every feature. Live mode unlocks after identity verification, which
          usually takes under five minutes.
        </motion.p>
        <motion.div
          variants={fadeUp}
          className="mt-2 flex flex-wrap items-center justify-center gap-3"
        >
          <InteractiveHoverButton
            type="button"
            icon={<MoveRight className="h-5 w-5" />}
            innerClassName="bg-white rounded-[8px]"
            className="font-poppins shadow-cta flex h-[48px] w-[200px] cursor-pointer items-center justify-center rounded-[8px] bg-[#02C76A] text-[14px] font-[600] text-white hover:text-[#050020]"
            onClick={() => router.push('/signup')}
          >
            Get your API keys
          </InteractiveHoverButton>
          <a
            href="/contact"
            className="font-poppins inline-flex h-[48px] items-center rounded-[8px] border border-white/20 bg-white/5 px-6 text-[14px] font-[500] text-white backdrop-blur transition-colors hover:bg-white/10"
          >
            Talk to sales
          </a>
        </motion.div>
      </motion.div>

      {/* Pulsing CTA pattern strip. Strimz-subscription signature */}
      <div className="relative mt-16 flex w-full items-center justify-center">
        <Image
          src={ctaPattern}
          alt=""
          aria-hidden
          width={1440}
          height={145}
          priority
          quality={100}
          className="h-[145px] w-full animate-pulse object-cover opacity-90"
        />
        <span className="absolute inline-flex h-[50px] w-[50px] md:h-[70px] md:w-[70px] lg:h-[90px] lg:w-[90px]">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#02C76A] opacity-70" />
          <Image
            src={strimzVector}
            alt=""
            aria-hidden
            width={120}
            height={120}
            priority
            quality={100}
            className="relative h-full w-full"
          />
        </span>
      </div>
    </section>
  )
}
