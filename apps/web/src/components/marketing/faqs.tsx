'use client'

import { ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'

const FAQS = [
  {
    q: 'How is Strimz different from Stripe for stablecoin payments?',
    a: 'Strimz is built for stablecoins natively. Customer doesn\'t pay gas (USDC is the native gas token on Arc). Idempotency is enforced on-chain via deterministic chargeAttemptIds. Reconciliation is via the on-chain log — your indexer can re-derive every penny.',
  },
  {
    q: 'Do my customers need to know about crypto?',
    a: 'No. The hosted checkout supports email + wallet + Google login (via Privy). Customers get an embedded Arc wallet automatically. They sign one approval; we charge them recurring without re-prompts.',
  },
  {
    q: 'What happens if a subscription charge fails?',
    a: 'The contract emits SubscriptionChargeSkipped with the typed outcome (insufficient_funds / revoked_approval / cancelled / not_due). The agent emails the customer per your configured strategy (once / twice / until_grace_ends) and your dashboard flips the sub to at_risk. After the grace window, we mark it lapsed and fire subscription.lapsed.',
  },
  {
    q: 'Can I refund a payment?',
    a: 'Yes — full and partial refunds. The API gives you wallet-signing instructions; you broadcast the refund tx. Our indexer detects the on-chain ERC-20 Transfer and flips the refund to completed automatically.',
  },
  {
    q: 'What about cross-chain payments?',
    a: 'CCTP V2 is integrated. Customers can pay from Ethereum, Base, Arbitrum, Polygon, Solana, etc. — Strimz polls Circle\'s attestation API and settles on Arc once the message is signed. You always get USDC on Arc.',
  },
  {
    q: 'How do I verify a webhook signature?',
    a: 'Every delivery has a Strimz-Signature header in the format t=<unix>,v1=<hex>. Re-compute hmac_sha256(secret, t.body) and compare timing-safe to v1. Reject when |now - t| > 300s. The @strimz/sdk package ships verifyWebhookSignature() ready-made.',
  },
] as const

export function Faqs() {
  return (
    <section className="bg-background py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <motion.div {...inViewOnce} variants={stagger(0.05, 0.1)} className="text-center">
          <motion.h2 variants={fadeUp} className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </motion.h2>
          <motion.p variants={fadeUp} className="mt-4 text-muted-foreground">
            Don't see yours?{' '}
            <a href="mailto:support@strimz.io" className="font-medium text-foreground underline-offset-4 hover:underline">
              Email us
            </a>{' '}
            — we answer every question.
          </motion.p>
        </motion.div>

        <motion.div {...inViewOnce} variants={stagger(0.05, 0.06)} className="mt-12 space-y-3">
          {FAQS.map((f, i) => (
            <FaqItem key={i} index={i} q={f.q} a={f.a} defaultOpen={i === 0} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function FaqItem({ q, a, index, defaultOpen }: { q: string; a: string; index: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen))
  return (
    <motion.div
      variants={fadeUp}
      className="strimz-card-shadow overflow-hidden rounded-xl border border-border/60 bg-muted/20"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
        aria-controls={`faq-answer-${index}`}
      >
        <span className="font-poppins font-medium">{q}</span>
        <ChevronDown
          className={`size-5 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <motion.div
        id={`faq-answer-${index}`}
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden"
      >
        <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>
      </motion.div>
    </motion.div>
  )
}
