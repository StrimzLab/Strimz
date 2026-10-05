'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'

type Tier = {
  name: string
  fee: string
  limit: string
  cta: string
  bullets: string[]
  featured?: boolean
}

const TIERS: readonly Tier[] = [
  {
    name: 'Free',
    fee: '0%',
    limit: 'First $1k volume',
    cta: 'Start free',
    bullets: ['All payment APIs', 'Recovery + digest', '1k webhook events / mo'],
  },
  {
    name: 'Starter',
    fee: '0.5%',
    limit: 'Up to $50k / mo',
    cta: 'Start with Starter',
    featured: true,
    bullets: ['Everything in Free', 'Anomaly + yield agent', 'Storefront builder'],
  },
  {
    name: 'Growth',
    fee: '0.4%',
    limit: 'Up to $1M / mo',
    cta: 'Talk to sales',
    bullets: ['Everything in Starter', 'Custom domains', 'CCTP V2 routing'],
  },
  {
    name: 'Enterprise',
    fee: 'Custom',
    limit: 'Unlimited',
    cta: 'Contact us',
    bullets: ['Everything in Growth', 'Dedicated SE', '99.99% SLA'],
  },
]

export function PricingTeaser() {
  return (
    <section className="bg-background w-full px-4 py-20 md:py-24">
      <motion.div
        {...inViewOnce}
        variants={stagger(0.05, 0.1)}
        className="mx-auto max-w-[640px] text-center"
      >
        <motion.h2
          variants={fadeUp}
          className="font-sora text-foreground text-[32px] font-[700] leading-[40px] md:text-[40px] md:leading-[48px]"
        >
          Pricing that gets cheaper as you grow.
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="font-poppins text-muted-foreground mt-4 text-base font-[400]"
        >
          You pay a percentage of each transaction. The more you process, the lower the rate. No
          platform fees. No hidden tiers.
        </motion.p>
      </motion.div>

      <motion.div
        {...inViewOnce}
        variants={stagger(0.05, 0.08)}
        className="mx-auto mt-12 grid max-w-[1200px] gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {TIERS.map((t) => (
          <motion.div
            key={t.name}
            variants={fadeUp}
            whileHover={{ y: -4 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className={[
              'bg-card flex flex-col rounded-[16px] p-6 transition-colors',
              t.featured ? 'shadow-sub-card border-accent border-2' : 'border-border border',
            ].join(' ')}
          >
            {t.featured && (
              <span className="font-poppins bg-accent mb-3 self-start rounded-full px-2.5 py-0.5 text-[11px] font-[600] text-white">
                Most popular
              </span>
            )}
            <div className="font-poppins text-muted-foreground text-[13px] font-[500]">
              {t.name}
            </div>
            <div className="font-sora text-foreground mt-2 text-[36px] font-[700] leading-none">
              {t.fee}
            </div>
            <div className="font-poppins text-muted-foreground mt-1 text-[11px]">
              per transaction
            </div>
            <div className="font-poppins text-foreground mt-4 text-sm font-[500]">{t.limit}</div>
            <ul className="font-poppins text-muted-foreground mt-4 flex-1 space-y-2 text-[13px]">
              {t.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <Check className="text-accent mt-0.5 size-4 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
            <Link
              href="/pricing"
              className={[
                'font-poppins mt-6 inline-flex h-[40px] items-center justify-center rounded-[8px] text-[14px] font-[500] transition-transform hover:scale-[1.02]',
                t.featured
                  ? 'shadow-cta bg-accent text-white'
                  : 'border-border bg-card text-foreground border',
              ].join(' ')}
            >
              {t.cta}
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <motion.div {...inViewOnce} variants={fadeUp} className="mt-8 text-center">
        <Link
          href="/pricing"
          className="font-poppins text-muted-foreground hover:text-foreground text-sm transition-colors"
        >
          See full pricing comparison →
        </Link>
      </motion.div>
    </section>
  )
}
