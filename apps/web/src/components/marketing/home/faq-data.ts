import { PLANS } from '@strimz/shared-config'

const usd = (n: number | null) => `$${(n ?? 0).toLocaleString('en-US')}`

export const FAQS = [
  {
    q: 'What does Strimz actually do?',
    a: 'Strimz lets your business take payments in stablecoins. You can charge a customer once, or set up a subscription that charges them every period. You get paid in USDC or EURC; we handle the on-chain side, refunds, webhooks, dashboards, and everything in between.',
  },
  {
    q: 'Do my customers need to understand crypto?',
    a: "A little. They pay from a wallet that holds USDC or EURC. They don't need gas: they approve the payment with a signature in their wallet and Strimz submits it for them.",
  },
  {
    q: 'Do I need to hold any crypto myself to use Strimz?',
    a: "Only a little USDC. Strimz pays the network fee for your customers' payments and subscription charges. Refunds and withdrawals you send from your own wallet cost a small network fee, paid in USDC, and nothing else.",
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
    a: 'Today customers pay on Arc, the network Strimz settles on. Paying from other networks is coming.',
  },
  {
    q: 'Where can I find the technical details?',
    a: 'In the docs at strimz.finance/docs: the API, SDKs, webhook signatures, contract architecture and error codes, from a 5-minute quickstart to self-hosting.',
  },
] as const

export const PRICING_FAQS = [
  {
    q: 'When does my plan change?',
    a: `Automatically. You move to ${PLANS.starter.name} once your all-time volume reaches ${usd(PLANS.starter.entersAtVolume)}, and to ${PLANS.growth.name} at ${usd(PLANS.growth.entersAtVolume)}. Plans only move up, never back down.`,
  },
  {
    q: 'Do USDC and EURC count together?',
    a: `No, each currency counts on its own. You reach ${PLANS.starter.name} once you have processed ${(PLANS.starter.entersAtVolume ?? 0).toLocaleString('en-US')} USDC or ${(PLANS.starter.entersAtVolume ?? 0).toLocaleString('en-US')} EURC.`,
  },
  {
    q: 'How is the fee charged?',
    a: 'On-chain, in the same transaction as the payment. Your customer pays the full price, you receive it minus the fee, and there is no separate invoice from Strimz.',
  },
  {
    q: 'Is there a monthly fee?',
    a: 'No. You only pay the per-transaction fee for your plan.',
  },
  {
    q: 'Who pays the network fee?',
    a: 'Not your customer. They sign the payment in their wallet, and the Strimz relayer submits it and pays the gas.',
  },
  {
    q: 'What does Enterprise include?',
    a: `Everything in ${PLANS.growth.name}, with a rate agreed by contract. Tell us about your volume and we will come back with one.`,
  },
] as const
