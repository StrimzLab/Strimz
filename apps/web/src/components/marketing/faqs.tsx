'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@strimz/ui'
import { motion } from 'framer-motion'
import { fadeUp, inViewOnce, stagger } from '@/lib/motion'

const FAQS = [
  {
    q: 'What does Strimz actually do?',
    a: "Strimz lets your business take payments in stablecoins. You can charge a customer once, or set up a subscription that charges them every period. You get paid in USDC; we handle the on-chain side, refunds, webhooks, dashboards, and everything in between.",
  },
  {
    q: 'Do my customers need to understand crypto?',
    a: "Not really. The checkout works with email, social login, or an existing wallet. If they don't have one, we create a wallet for them in the background. They approve the payment once and never have to think about it again.",
  },
  {
    q: 'Do I need to hold any crypto myself to use Strimz?',
    a: "Only the USDC you receive from your customers. Strimz takes care of gas through Arc (where USDC is the gas token), so you don't have to top up ETH or anything else.",
  },
  {
    q: 'Is Strimz custodial? Do you hold my money?',
    a: "No. Strimz is non-custodial. Every payment settles directly into a wallet you control. There's no Strimz balance you have to wait days to withdraw.",
  },
  {
    q: 'How does pricing work?',
    a: "You pay a small percentage of each transaction. The more volume you do, the lower your rate. The fee is taken on-chain in the same transaction, so what you see is what lands in your wallet. There are no platform fees on top.",
  },
  {
    q: 'Can Strimz handle subscriptions, or only one-off payments?',
    a: "Both. One-off payments are a single hosted checkout. Subscriptions ask the customer to approve recurring charges once, and we charge them every period after that. You don't have to ask again.",
  },
  {
    q: 'What happens if a subscription charge fails?',
    a: "The subscription moves into an at-risk state and the AutoPay Agent emails the customer asking them to top up. You can pick the recovery strategy and grace window. If the grace window passes without a successful charge, the subscription lapses and we let you know.",
  },
  {
    q: 'Can I refund a customer?',
    a: "Yes, full or partial. You sign the refund from your own wallet (we never custody your funds), and we update the dashboard automatically once the on-chain transfer goes through.",
  },
  {
    q: 'What if my customer wants to pay from a different chain?',
    a: "That works too. They can pay in USDC from Ethereum, Base, Polygon, Solana, and most other chains. We bridge it to Arc behind the scenes, and you receive USDC on Arc as normal.",
  },
  {
    q: 'Where can I find the technical details?',
    a: "All the technical details — APIs, SDKs, webhook signatures, contract architecture, error codes — live in the docs at /docs. They cover everything from a 5-minute quickstart to self-hosting.",
  },
] as const

export function Faqs() {
  return (
    <section className="w-full bg-white px-6 py-16 md:py-20">
      <motion.div
        {...inViewOnce}
        variants={stagger(0.05, 0.1)}
        className="mx-auto max-w-[996px] text-center"
      >
        <motion.h2
          variants={fadeUp}
          className="font-sora text-[32px] font-[700] leading-[40px] text-[#050020] md:text-[40px] md:leading-[48px]"
        >
          Frequently asked questions
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-4 font-poppins text-base font-[400] text-[#58556A]"
        >
          Don&apos;t see yours?{' '}
          <a
            href="mailto:support@strimz.finance"
            className="font-[500] text-[#050020] underline-offset-4 hover:underline"
          >
            Email us
          </a>
          . Real people read every message.
        </motion.p>
      </motion.div>

      <motion.div
        {...inViewOnce}
        variants={fadeUp}
        className="mx-auto mt-10 max-w-[996px]"
      >
        <Accordion type="single" defaultValue="0" collapsible className="space-y-2">
          {FAQS.map((f, i) => (
            <AccordionItem
              key={i}
              value={String(i)}
              className="rounded-[8px] border border-[#E5E7EB] bg-[#F3F4F6] px-4 md:px-8"
            >
              <AccordionTrigger className="py-4 font-poppins text-[16px] font-[500] text-[#050020] md:text-[18px] md:leading-[28px]">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="pb-4 font-poppins text-base leading-[28px] text-[#58556A]">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>
    </section>
  )
}
