import { PLANS } from '@strimz/shared-config'

export type AuthVariant = 'new' | 'returning'

export function authVariant(pathname: string): AuthVariant {
  return pathname.startsWith('/signup') || pathname.startsWith('/onboarding') ? 'new' : 'returning'
}

const freeRate = `${(PLANS.free.feeBps ?? 0) / 100}%`
const freeLimit = `$${(PLANS.starter.entersAtVolume ?? 0).toLocaleString('en-US')}`

export const AUTH_COPY = {
  new: {
    title: 'Get paid in USDC and EURC, straight to your wallet.',
    benefits: [
      {
        title: 'Paid in seconds',
        body: 'Each payment settles moments after your customer approves it.',
      },
      {
        title: 'Into your own wallet',
        body: 'Strimz never holds your money.',
      },
      {
        title: 'Free to start',
        body: `${freeRate} on your first ${freeLimit}.`,
      },
    ],
    card: {
      tag: 'Sample',
      title: 'Payment received',
      amount: '+49.00',
      unit: 'USDC',
      meta: 'Pro plan · settled',
    },
  },
  returning: {
    title: 'Welcome back.',
    body: 'Your payments, subscriptions and invoices are where you left them.',
    card: {
      tag: 'Sample',
      title: 'This month',
      amount: '3,420.00',
      unit: 'USDC',
      meta: '48 payments',
      bars: [32, 45, 38, 52, 60, 48, 70, 66, 82, 74, 90, 86],
    },
  },
} as const
