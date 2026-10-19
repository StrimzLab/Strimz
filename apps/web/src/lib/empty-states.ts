import { NEW_PAYMENT_LINK_HREF } from './first-run'

export interface EmptyStateCopy {
  title: string
  description: string
  action: { label: string; href: string }
}

const NEW_PLAN_HREF = '/app/plans?new=1'

export const EMPTY_STATES = {
  paymentLinks: {
    title: 'No payment links yet',
    description:
      'Each link is a one-time checkout for a set amount. Create one, send it to a customer, and the payment lands in your wallet.',
    action: { label: 'Create a payment link', href: NEW_PAYMENT_LINK_HREF },
  },
  plans: {
    title: 'No plans yet',
    description:
      'A plan is a recurring price. Customers approve it once and are charged every period after that.',
    action: { label: 'Create a plan', href: NEW_PLAN_HREF },
  },
  subscriptions: {
    title: 'No subscriptions yet',
    description:
      'When a customer approves a plan, their subscription appears here and renews on its own.',
    action: { label: 'Create a plan', href: NEW_PLAN_HREF },
  },
  invoices: {
    title: 'No invoices yet',
    description:
      'Add line items and a due date, and Strimz emails your client an invoice with a Pay button.',
    action: { label: 'Create an invoice', href: '/app/invoices/new' },
  },
  customers: {
    title: 'No customers yet',
    description:
      'Anyone who pays you through a link, plan or invoice is listed here with their payment history.',
    action: { label: 'Create a payment link', href: NEW_PAYMENT_LINK_HREF },
  },
  transactions: {
    title: 'No transactions yet',
    description:
      'Every confirmed payment, subscription charge and refund appears here, with its on-chain receipt.',
    action: { label: 'Create a payment link', href: NEW_PAYMENT_LINK_HREF },
  },
  refunds: {
    title: 'No refunds yet',
    description:
      'To refund a customer, open the payment in Transactions and choose Refund. It will show here once sent.',
    action: { label: 'Go to transactions', href: '/app/transactions' },
  },
} as const satisfies Record<string, EmptyStateCopy>
