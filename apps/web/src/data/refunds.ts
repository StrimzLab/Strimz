import { TRANSACTIONS } from './transactions'
import { daysAgo, id, mulberry32, pick, txHash } from './_seed'

export type RefundStatus = 'awaiting_signature' | 'submitted' | 'completed' | 'failed'

export type RefundReason = 'customer_request' | 'product_issue' | 'duplicate_charge' | 'fraudulent' | 'other'

export type Refund = {
  id: string
  transactionId: string
  amountUsdc: number
  reason: RefundReason
  note: string
  status: RefundStatus
  payerWallet: string
  refundTxHash: string | null
  createdAt: string
  completedAt: string | null
}

const REASONS: RefundReason[] = ['customer_request', 'product_issue', 'duplicate_charge', 'fraudulent', 'other']
const STATUSES: RefundStatus[] = ['completed', 'completed', 'completed', 'submitted', 'awaiting_signature', 'failed']
const NOTES = [
  'Buyer cancelled within 24h window',
  'Product shipped damaged — replaced + refunded',
  'Duplicate session created on retry',
  'Reported as fraudulent by issuing wallet',
  'Goodwill refund (customer reported confusion)',
  'Subscription cancelled mid-period — pro-rated',
]

const rng = mulberry32(19)
const refundable = TRANSACTIONS.filter((t) => t.kind !== 'refund').slice(0, 18)

export const REFUNDS: Refund[] = refundable.map((tx, i) => {
  const status = pick(rng, STATUSES)
  const created = Math.floor(rng() * 30)
  const partial = rng() > 0.5
  return {
    id: id('rf', i + 1),
    transactionId: tx.id,
    amountUsdc: partial ? Math.floor(tx.amountUsdc * (rng() * 0.6 + 0.2)) : tx.amountUsdc,
    reason: pick(rng, REASONS),
    note: pick(rng, NOTES),
    status,
    payerWallet: tx.customerWallet,
    refundTxHash: status === 'completed' || status === 'submitted' ? txHash(rng) : null,
    createdAt: daysAgo(created),
    completedAt: status === 'completed' ? daysAgo(created, 14) : null,
  }
}).slice(0, 14)
