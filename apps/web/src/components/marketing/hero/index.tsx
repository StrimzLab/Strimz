'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { AuroraBackground, AuroraGrid } from '@/components/effects/aurora-background'
import { InteractiveHoverButton } from '@/components/effects/interactive-hover-button'
import { Badge } from '@strimz/ui'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'
import { HeroOrb } from './hero-orb'
import { CodeWindow } from './code-window'

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <AuroraBackground variant="bold" />
      <AuroraGrid />

      <div className="relative mx-auto max-w-7xl px-4 pt-20 pb-24 sm:px-6 sm:pt-28 sm:pb-32">
        <motion.div
          {...inViewOnce}
          variants={stagger(0.05, 0.08)}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div variants={fadeUp}>
            <Badge variant="outline" className="mb-6 gap-1.5 px-3 py-1">
              <span className="size-1.5 rounded-full bg-[#02C76A]" />
              Live on Arc testnet
            </Badge>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
          >
            The billing API
            <br />
            <span className="bg-gradient-to-br from-[#02C76A] via-[#10b981] to-cyan-400 bg-clip-text text-transparent">
              built on stablecoins.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl"
          >
            One API for one-shot payments, recurring subscriptions, refunds, agent escrow, and
            cross-chain settlement. Everything settles in USDC on Arc — gas-free for your
            customers, instant payouts for you.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <InteractiveHoverButton
              type="button"
              icon={<ArrowRight className="size-4" />}
              innerClassName="bg-white rounded-md"
              className="strimz-cta-shadow flex h-12 w-[170px] items-center justify-center rounded-md bg-[#02C76A] font-poppins text-sm font-medium text-white hover:text-white"
              onClick={() => (window.location.href = '/signup')}
            >
              Start building
            </InteractiveHoverButton>
            <Link
              href="/docs"
              className="inline-flex h-12 items-center rounded-md border border-border px-6 text-sm font-medium transition-colors hover:bg-muted"
            >
              Read the docs
            </Link>
          </motion.div>

          <motion.p variants={fadeUp} className="mt-6 text-xs text-muted-foreground">
            No credit card · USDC-native · Free tier ships immediately
          </motion.p>
        </motion.div>

        <div className="mt-20 grid items-center gap-16 lg:grid-cols-2">
          <HeroOrb />
          <CodeWindow />
        </div>
      </div>
    </section>
  )
}
