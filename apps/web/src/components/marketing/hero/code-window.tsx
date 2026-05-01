'use client'

import { motion } from 'framer-motion'
import { fadeUp, inViewOnce } from '@/lib/motion'

export function CodeWindow() {
  return (
    <motion.div {...inViewOnce} variants={fadeUp} className="relative">
      <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-[#02C76A]/30 via-cyan-400/15 to-transparent blur-2xl" />
      <div className="strimz-card-shadow relative overflow-hidden rounded-xl border border-border/60 bg-background/95">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-rose-500" />
          <span className="size-2.5 rounded-full bg-amber-500" />
          <span className="size-2.5 rounded-full bg-emerald-500" />
          <span className="ml-3 font-mono text-xs text-muted-foreground">strimz.ts</span>
        </div>
        <pre className="overflow-x-auto p-5 text-sm leading-relaxed">
          <code className="text-foreground/90">
{`import { Strimz } from '@strimz/sdk'

const strimz = new Strimz({ apiKey: process.env.STRIMZ_KEY })

`}
            <span className="text-muted-foreground">{'// Charge a one-shot payment'}</span>
{`
const session = await strimz.paymentSessions.create({
  amount:   '50000000',     `}<span className="text-muted-foreground">{'// 50 USDC (6 decimals)'}</span>{`
  currency: 'USDC',
  description: 'Pro plan, August',
})

`}
            <span className="text-muted-foreground">{'// Or open a subscription with one signature'}</span>{`
const sub = await strimz.subscriptions.checkoutUrl({
  planId: 'plan_pro_monthly',
  customerEmail: 'buyer@acme.com',
})`}
          </code>
        </pre>
      </div>
    </motion.div>
  )
}
