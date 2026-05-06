import { CUSTOMERS } from './customers'
import { daysAgo, id, mulberry32, pick, range, txHash } from './_seed'

export type TransactionKind = 'one_shot' | 'subscription_charge' | 'refund'

export type Transaction = {
  id: string
  kind: TransactionKind
  amountUsdc: number
  feeUsdc: number
  netUsdc: number
  customerId: string
  customerWallet: string
  txHash: string
  blockNumber: number
  confirmedAt: string
  description: string
}

const rng = mulberry32(31)
const FEE_BPS = 50 // 0.5%

export const TRANSACTIONS: Transaction[] = range(96)
  .map((i) => {
    const kind = pick(rng, ['one_shot', 'subscription_charge', 'subscription_charge', 'refund'] as TransactionKind[])
    const customer = CUSTOMERS[Math.floor(rng() * CUSTOMERS.length)]!
    const amount = Math.floor(rng() * 500_000_000) + 5_000_000
    const fee = kind === 'refund' ? 0 : Math.floor((amount * FEE_BPS) / 10_000)
    return {
      id: id('tx', i + 1),
      kind,
      amountUsdc: kind === 'refund' ? -amount : amount,
      feeUsdc: fee,
      netUsdc: kind === 'refund' ? -amount : amount - fee,
      customerId: customer.id,
      customerWallet: customer.walletAddress,
      txHash: txHash(rng),
      blockNumber: 18_402_001 + i * 137,
      confirmedAt: daysAgo(Math.floor(rng() * 60)),
      description: kind === 'one_shot' ? 'One-shot payment'
        : kind === 'subscription_charge' ? 'Subscription charge'
        : 'Refund',
    }
  })
  .sort((a, b) => +new Date(b.confirmedAt) - +new Date(a.confirmedAt))
