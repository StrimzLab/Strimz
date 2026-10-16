'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@strimz/ui'
import { motion } from 'framer-motion'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'

const FAQS = [
  {
    q: 'What does Strimz actually do?',
    a: 'Strimz lets your business take payments in stablecoins. You can charge a customer once, or set up a subscription that charges them every period. You get paid in USDC or EURC; we handle the on-chain side, refunds, webhooks, dashboards, and everything in between.',
  },
  {
    q: 'Do my customers need to understand crypto?',
    a: "A little. Today they pay from a wallet that holds USDC or EURC on Arc. They don't need gas: they approve the payment with a signature in their wallet and Strimz submits it for them.",
  },
  {
    q: 'Do I need to hold any crypto myself to use Strimz?',
    a: "Only a little USDC. Strimz pays the gas for your customers' payments and subscription charges. On Arc, USDC is the gas token, so refunds and withdrawals you send from your own wallet cost a small amount of USDC, and nothing else.",
  },
  {
    q: 'Is Strimz custodial? Do you hold my money?',
    a: "No. Strimz is non-custodial. Every payment settles directly into a wallet you control. There's no Strimz balance you have to wait days to withdraw.",
  },
  {
    q: 'How does pricing work?',
    a: 'You pay a small percentage of each transaction: 0% on your first $1,000, then 0.5%, dropping to 0.4% from $50,000. The fee is taken on-chain in the same transaction, so what you see is what lands in your wallet. There are no platform fees on top.',
  },
  {
    q: 'Can Strimz handle subscriptions, or only one-off payments?',
    a: "Both. One-off payments are a single hosted checkout. Subscriptions ask the customer to approve recurring charges once, and we charge them every period after that. You don't have to ask again.",
  },
  {
    q: 'What happens if a subscription charge fails?',
    a: 'The subscription moves into an at-risk state and Strimz retries the charge. If you turn on recovery emails, the AutoPay Agent also asks the customer to top up. If the charge still fails 48 hours after the period ends, the subscription lapses and we let you know.',
  },
  {
    q: 'Can I refund a customer?',
    a: 'Yes, full or partial. You sign the refund from your own wallet (we never custody your funds), and we update the dashboard automatically once the on-chain transfer goes through.',
  },
  {
    q: 'What if my customer wants to pay from a different chain?',
    a: 'Paying from other chains is coming. Today customers pay on Arc directly.',
  },
  {
    q: 'Where can I find the technical details?',
    a: 'In the docs at strimz.finance/docs: the API, SDKs, webhook signatures, contract architecture and error codes, from a 5-minute quickstart to self-hosting.',
  },
] as const

export function Faqs() {
  return (
    <section className="bg-background w-full px-6 py-16 md:py-20">
      <motion.div
        {...inViewOnce}
        variants={stagger(0.05, 0.1)}
        className="mx-auto max-w-[996px] text-center"
      >
        <motion.h2
          variants={fadeUp}
          className="font-sora text-foreground text-[32px] font-[700] leading-[40px] md:text-[40px] md:leading-[48px]"
        >
          Frequently asked questions
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="font-poppins text-muted-foreground mt-4 text-base font-[400]"
        >
          Don&apos;t see yours?{' '}
          <a
            href="mailto:support@strimz.finance"
            className="text-foreground font-[500] underline-offset-4 hover:underline"
          >
            Email us
          </a>
          . Real people read every message.
        </motion.p>
      </motion.div>

      <motion.div {...inViewOnce} variants={fadeUp} className="mx-auto mt-10 max-w-[996px]">
        <Accordion type="single" defaultValue="0" collapsible className="space-y-2">
          {FAQS.map((f, i) => (
            <AccordionItem
              key={i}
              value={String(i)}
              className="border-border bg-secondary rounded-[8px] border px-4 md:px-8"
            >
              <AccordionTrigger className="font-poppins text-foreground py-4 text-[16px] font-[500] md:text-[18px] md:leading-[28px]">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="font-poppins text-muted-foreground pb-4 text-base leading-[28px]">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>
    </section>
  )
}
