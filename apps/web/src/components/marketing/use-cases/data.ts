import { firstYearFees } from '@/lib/fee-estimate'

export type UseCaseId = 'saas' | 'marketplaces' | 'creators' | 'agencies' | 'global-b2b'
export type MockKind = 'subscriptions' | 'order' | 'storefront' | 'invoice' | 'payment-link'

export interface UseCase {
  id: UseCaseId
  label: string
  title: string
  job: string
  features: readonly { title: string; body: string; href: string }[]
  limit?: string
  mock: MockKind
  sample: {
    count: number
    unit: string
    unitAmount: number
    monthlyVolume: number
    currency: 'USDC' | 'EURC'
  }
}

function sample(
  count: number,
  unit: string,
  unitAmount: number,
  currency: 'USDC' | 'EURC' = 'USDC',
) {
  return { count, unit, unitAmount, monthlyVolume: count * unitAmount, currency }
}

export const USE_CASES: readonly UseCase[] = [
  {
    id: 'saas',
    label: 'SaaS',
    title: 'Charge every month without asking every month.',
    job: 'Your customers pick a plan, try it, and keep paying while they use it. You want renewals to happen on their own and to hear about the ones that fail.',
    features: [
      {
        title: 'Subscriptions with free trials',
        body: 'Daily to yearly plans in USDC or EURC. The customer approves once; the first charge waits for the trial to end.',
        href: '/docs/guides/subscriptions',
      },
      {
        title: 'Failed-charge recovery',
        body: 'Strimz retries a failed renewal and can email the customer to top up. You get a webhook either way.',
        href: '/docs/subscriptions/recovery',
      },
      {
        title: 'Self-serve cancel',
        body: 'A cancel button in your app that calls one API method, without exposing your secret key.',
        href: '/docs/recipes/self-serve-cancel',
      },
    ],
    mock: 'subscriptions',
    sample: sample(200, 'customers', 49),
  },
  {
    id: 'marketplaces',
    label: 'Marketplaces',
    title: 'A checkout for every order, and your system kept in step.',
    job: 'Buyers check out on your platform and your order system needs to know the moment each payment lands, with a clean way to refund.',
    features: [
      {
        title: 'A checkout per order',
        body: 'Create a payment session for each order, with your own metadata, and send the buyer to the hosted page.',
        href: '/docs/guides/accept-payment',
      },
      {
        title: 'Signed webhooks',
        body: 'Every event is signed, so your order system can trust it and mark the order paid without polling.',
        href: '/docs/guides/webhooks',
      },
      {
        title: 'Full or partial refunds',
        body: 'Refund from your own wallet, and the dashboard records it once the transfer settles.',
        href: '/docs/guides/refunds',
      },
    ],
    limit:
      'Payments settle to your wallet. Strimz does not split payouts to sellers, so paying them stays with you.',
    mock: 'order',
    sample: sample(400, 'orders', 60),
  },
  {
    id: 'creators',
    label: 'Creators',
    title: 'Sell memberships and one-off products from one page.',
    job: 'You want a place to list what you sell, a monthly membership for your regulars, and a link you can drop anywhere.',
    features: [
      {
        title: 'A no-code storefront',
        body: 'A branded page at strimz.finance/store with your products, each a one-off or subscription checkout. Starts on Starter.',
        href: '/docs/guides/storefronts',
      },
      {
        title: 'Memberships',
        body: 'Monthly or yearly plans members approve once and can cancel from their own wallet.',
        href: '/docs/guides/subscriptions',
      },
      {
        title: 'Payment links',
        body: 'A link for a single payment you can post, message or put in a bio. No backend needed.',
        href: '/docs/recipes/invoice-link',
      },
    ],
    mock: 'storefront',
    sample: sample(500, 'members', 8),
  },
  {
    id: 'agencies',
    label: 'Agencies',
    title: 'Send the invoice, get paid, and know when it lands.',
    job: 'Clients pay project fees and monthly retainers. You want invoices that are easy to pay and a record of each one.',
    features: [
      {
        title: 'Invoices with a Pay button',
        body: 'Add line items and a due date. Strimz emails your client the invoice with a button that opens checkout.',
        href: '/docs/guides/invoices',
      },
      {
        title: 'Numbered, with a PDF',
        body: 'Invoices are numbered for you, year by year, and you can download a PDF from the dashboard.',
        href: '/docs/guides/invoices',
      },
      {
        title: 'Retainers as subscriptions',
        body: 'Put a monthly retainer on a plan so it charges itself after the client approves once.',
        href: '/docs/guides/subscriptions',
      },
    ],
    mock: 'invoice',
    sample: sample(4, 'retainers', 3_000, 'EURC'),
  },
  {
    id: 'global-b2b',
    label: 'Global B2B',
    title: 'Bill clients abroad in dollars or euros.',
    job: 'Your clients are in other countries. You want to bill in a stable currency they already hold and have it settle to you directly.',
    features: [
      {
        title: 'USDC or EURC',
        body: 'Price plans and payments in either stablecoin. Each one counts toward your plan on its own.',
        href: '/docs/subscriptions/plans',
      },
      {
        title: 'Straight to your wallet',
        body: 'Payments settle into a wallet you control. Strimz never holds your money.',
        href: '/docs/concepts/meta-tx-flow',
      },
      {
        title: 'No gas for your client',
        body: 'Your client signs in their wallet and the Strimz relayer submits the payment and pays the network fee.',
        href: '/docs/checkout/hosted',
      },
    ],
    mock: 'payment-link',
    sample: sample(3, 'invoices', 8_000, 'EURC'),
  },
]

export function sampleCost(s: UseCase['sample']): { fees: number; effectiveRate: number } {
  const year = firstYearFees(s.monthlyVolume)
  return { fees: year.fees, effectiveRate: year.effectiveRate }
}
