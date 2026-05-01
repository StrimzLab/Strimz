'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Code2 } from 'lucide-react'
import { Badge } from '@strimz/ui'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'

const TABS = [
  { id: 'server', label: '@strimz/sdk', desc: 'Server' },
  { id: 'react', label: '@strimz/sdk-react', desc: 'React' },
  { id: 'spec', label: 'OpenAPI 3.1', desc: 'Spec' },
] as const

export function Developers() {
  return (
    <section className="border-y border-border/40 bg-muted/20">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 py-24 sm:px-6 lg:grid-cols-2">
        <motion.div {...inViewOnce} variants={stagger(0.05, 0.1)}>
          <motion.div variants={fadeUp}>
            <Badge className="mb-4 bg-[#02C76A]/10 text-[#02C76A] hover:bg-[#02C76A]/15">Developers</Badge>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            SDKs that feel like Stripe.
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-muted-foreground">
            Server SDK for Node + Bun. React SDK for embedded checkout. Webhook signatures use
            the Stripe-style{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">t=…,v1=…</code> format
            with 5-minute replay tolerance.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 grid gap-3 sm:grid-cols-3">
            {TABS.map((p) => (
              <div key={p.id} className="strimz-card-shadow rounded-lg border border-border/60 bg-background p-4">
                <div className="font-mono text-sm">{p.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{p.desc}</div>
              </div>
            ))}
          </motion.div>

          <motion.div variants={fadeUp} className="mt-8">
            <Link
              href="/docs"
              className="strimz-cta-shadow inline-flex h-11 items-center gap-2 rounded-md bg-[#02C76A] px-5 text-sm font-medium text-white"
            >
              <Code2 className="size-4" />
              Open the docs
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </motion.div>

        <motion.div {...inViewOnce} variants={fadeUp} className="relative">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-[#02C76A]/30 via-cyan-400/15 to-transparent blur-2xl" />
          <div className="strimz-card-shadow relative overflow-hidden rounded-xl border border-border/60 bg-[#050020] text-white">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-white/70">
              <span className="size-2.5 rounded-full bg-rose-500" />
              <span className="size-2.5 rounded-full bg-amber-500" />
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <span className="ml-3 font-mono text-xs">checkout.tsx</span>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed text-white/90">
              <code>{`'use client'
import { StrimzPayButton } from '@strimz/sdk-react'

export function Checkout() {
  return (
    <StrimzPayButton
      sessionId={session.id}
      onSuccess={(tx) => router.push('/thanks')}
    />
  )
}`}</code>
            </pre>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
