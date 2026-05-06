import { CUSTOMERS } from './customers'
import { daysAgo, id, mulberry32, pick, range } from './_seed'

export type SubscriptionStatus = 'active' | 'trialing' | 'at_risk' | 'paused' | 'cancelled' | 'lapsed'

export type SubscriptionPlan = {
  id: string
  name: string
  amountUsdc: number
  interval: 'monthly' | 'quarterly' | 'yearly' | 'weekly'
  intervalCount: number
  trialPeriodDays: number
  activeSubscribers: number
}

export const PLANS: SubscriptionPlan[] = [
  { id: 'plan_starter', name: 'Starter', amountUsdc: 19_000_000, interval: 'monthly', intervalCount: 1, trialPeriodDays: 14, activeSubscribers: 21 },
  { id: 'plan_pro', name: 'Pro', amountUsdc: 49_000_000, interval: 'monthly', intervalCount: 1, trialPeriodDays: 14, activeSubscribers: 14 },
  { id: 'plan_team', name: 'Team', amountUsdc: 199_000_000, interval: 'monthly', intervalCount: 1, trialPeriodDays: 0, activeSubscribers: 6 },
  { id: 'plan_pro_annual', name: 'Pro (annual)', amountUsdc: 490_000_000, interval: 'yearly', intervalCount: 1, trialPeriodDays: 0, activeSubscribers: 4 },
]

export type Subscription = {
  id: string
  planId: string
  planName: string
  customerId: string
  customerWallet: string
  customerEmail: string | null
  amountUsdc: number
  interval: SubscriptionPlan['interval']
  status: SubscriptionStatus
  currentPeriodStartAt: string
  currentPeriodEndAt: string
  nextChargeAt: string
  createdAt: string
  totalChargedUsdc: number
  failedCharges: number
}

const STATUSES: SubscriptionStatus[] = [
  'active', 'active', 'active', 'active', 'active',
  'trialing', 'trialing',
  'at_risk', 'at_risk',
  'paused',
  'cancelled', 'cancelled',
  'lapsed',
]

const rng = mulberry32(101)

export const SUBSCRIPTIONS: Subscription[] = range(45).map((i) => {
  const plan = pick(rng, PLANS)
  const customer = CUSTOMERS[Math.floor(rng() * CUSTOMERS.length)]!
  const status = pick(rng, STATUSES)
  const periodLength = plan.interval === 'yearly' ? 365 : plan.interval === 'monthly' ? 30 : 7
  const periodStartDays = Math.floor(rng() * periodLength)
  const totalCharges = Math.floor(rng() * 12) + 1
  return {
    id: id('sub', i + 1),
    planId: plan.id,
    planName: plan.name,
    customerId: customer.id,
    customerWallet: customer.walletAddress,
    customerEmail: customer.email,
    amountUsdc: plan.amountUsdc,
    interval: plan.interval,
    status,
    currentPeriodStartAt: daysAgo(periodStartDays),
    currentPeriodEndAt: daysAgo(periodStartDays - periodLength),
    nextChargeAt: daysAgo(periodStartDays - periodLength),
    createdAt: daysAgo(Math.floor(rng() * 240) + 14),
    totalChargedUsdc: plan.amountUsdc * totalCharges,
    failedCharges: status === 'at_risk' ? Math.floor(rng() * 2) + 1 : 0,
  }
})
