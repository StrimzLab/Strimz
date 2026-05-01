'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Badge } from '@strimz/ui'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'
import { cn } from '@strimz/ui'

const TIERS = [
  { name: 'Free', fee: '0%', limit: 'First $1k volume', cta: 'Start free' },
  { name: 'Starter', fee: '0.5%', limit: 'Up to $50k/mo', cta: 'Start with Starter', featured: true },
  { name: 'Growth', fee: '0.4%', limit: 'Up to $1M/mo', cta: 'Talk to sales' },
  { name: 'Enterprise', fee: 'Custom', limit: 'Unlimited', cta: 'Contact us' },
] as const

export function PricingTeaser() {
  return (
    <section className="bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <motion.div {...inViewOnce} variants={stagger(0.05, 0.1)} className="mx-auto max-w-2xl text-center">
          <motion.h2 variants={fadeUp} className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Pricing that scales with your volume.
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-muted-foreground">
            Pay-as-you-grow on every dollar processed. No platform fees, no hidden tiers.
          </motion.p>
        </motion.div>

        <motion.div {...inViewOnce} variants={stagger(0.05, 0.08)} className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              className={cn(
                'flex flex-col rounded-xl border bg-background p-6 transition-colors',
                t.featured ? 'border-[#02C76A] strimz-card-shadow ring-1 ring-[#02C76A]' : 'border-border/60',
              )}
            >
              {t.featured && (
                <Badge className="mb-3 self-start bg-[#02C76A] text-white hover:bg-[#02C76A]">Most popular</Badge>
              )}
              <div className="text-sm font-medium text-muted-foreground">{t.name}</div>
              <div className="mt-2 text-3xl font-bold">{t.fee}</div>
              <div className="mt-1 text-xs text-muted-foreground">per transaction</div>
              <div className="mt-4 text-sm">{t.limit}</div>
              <Link
                href="/pricing"
                className={cn(
                  'mt-6 inline-flex h-10 items-center justify-center rounded-md text-sm font-medium transition-transform hover:scale-[1.02]',
                  t.featured
                    ? 'strimz-cta-shadow bg-[#02C76A] text-white'
                    : 'border border-border bg-background',
                )}
              >
                {t.cta}
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div {...inViewOnce} variants={fadeUp} className="mt-8 text-center">
          <Link href="/pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            See full pricing comparison →
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
