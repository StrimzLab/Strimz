'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'
import { PaddedLines } from '@/components/shared/padded-lines'
import art1 from '@/../public/art/1.svg'
import art2 from '@/../public/art/2.svg'
import art3 from '@/../public/art/3.svg'

const FEATURES = [
  {
    icon: art1,
    title: 'Retries that can’t double-charge',
    body: 'Every charge attempt has a unique ID built from the subscription and period. Retry the same call a hundred times and only one charge lands. The contract enforces it, not the database.',
  },
  {
    icon: art2,
    title: 'Subscriptions that don’t expire',
    body: 'Your customer signs one transaction. We charge them every period after that — daily, weekly, monthly, yearly — without asking again. There’s no card to expire and no payment method to update.',
  },
  {
    icon: art3,
    title: 'Settlement in seconds',
    body: 'Payments confirm in about 13 seconds and the USDC lands in your payout wallet right away. No three-day hold. No chargeback window. The on-chain hash is your receipt.',
  },
] as const

/**
 * Dark-navy feature strip — the visual anchor of the marketing flow.
 * Mirrors strimz-subscription's `Features` section: bg-primary, three
 * art-icon cards, capped with PaddedLines.
 */
export function Features() {
  return (
    <>
      <section className="w-full bg-[#050020] px-4 py-12 md:px-0 md:py-20">
        <motion.div
          {...inViewOnce}
          variants={stagger(0.06, 0.1)}
          className="mx-auto grid max-w-[1200px] gap-6 md:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className="flex w-full flex-col p-4"
            >
              <Image
                src={f.icon}
                alt=""
                aria-hidden
                width={72}
                height={72}
                priority
                quality={100}
                className="h-[72px] w-[72px]"
              />
              <h3 className="mt-6 font-sora text-[24px] font-[600] leading-[32px] text-white">
                {f.title}
              </h3>
              <p className="mt-2 font-poppins text-base font-[400] leading-[28px] text-[#BCBAC4]">
                {f.body}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </section>
      <PaddedLines />
    </>
  )
}
