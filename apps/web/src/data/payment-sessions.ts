import { CUSTOMERS } from './customers'
import { daysAgo, id, mulberry32, pick, range, txHash } from './_seed'

export type PaymentSessionStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'refunded'

export type PaymentSession = {
  id: string
  amountUsdc: number
  description: string
  status: PaymentSessionStatus
  customerId: string | null
  customerWallet: string | null
  txHash: string | null
  createdAt: string
  expiresAt: string
  confirmedAt: string | null
}

const DESCRIPTIONS = [
  'Pro plan, August', 'Annual subscription renewal', 'API overage fee',
  'Onboarding session', 'Custom integration deposit', 'Hardware wallet bundle',
  'Setup + migration package', 'Training workshop', 'Pro plan, July',
  'Add-on: dedicated support', 'Compliance audit fee', 'Account top-up',
]

const STATUSES: PaymentSessionStatus[] = [
  'confirmed', 'confirmed', 'confirmed', 'confirmed', 'confirmed', 'confirmed',
  'pending', 'pending',
  'cancelled',
  'expired',
  'refunded',
]

const rng = mulberry32(73)

export const PAYMENT_SESSIONS: PaymentSession[] = range(64).map((i) => {
  const status = pick(rng, STATUSES)
  const created = Math.floor(rng() * 60)
  const customer = rng() > 0.15 ? CUSTOMERS[Math.floor(rng() * CUSTOMERS.length)]! : null
  return {
    id: id('sess', i + 1),
    amountUsdc: Math.floor(rng() * 500_000_000) + 5_000_000,
    description: pick(rng, DESCRIPTIONS),
    status,
    customerId: customer?.id ?? null,
    customerWallet: customer?.walletAddress ?? null,
    txHash: status === 'confirmed' || status === 'refunded' ? txHash(rng) : null,
    createdAt: daysAgo(created),
    expiresAt: daysAgo(created - 1),
    confirmedAt: status === 'confirmed' || status === 'refunded' ? daysAgo(created, 13) : null,
  }
})
