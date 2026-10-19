export interface FirstRunProgress {
  /** A payment link or plan exists. */
  created: boolean
  /** At least one payment has confirmed. */
  paid: boolean
}

export interface FirstRunStep {
  title: string
  body: string
  href: string
  done: boolean
}

export interface FirstRunPath {
  id: 'no-code' | 'developer'
  label: string
  steps: FirstRunStep[]
}

export const NEW_PAYMENT_LINK_HREF = '/app/payment-sessions?new=1'

export function firstRunSteps({ created, paid }: FirstRunProgress): FirstRunPath[] {
  return [
    {
      id: 'no-code',
      label: 'No code',
      steps: [
        {
          title: 'Create a payment link or a plan',
          body: 'Set an amount in USDC or EURC. A plan charges the same customer every period.',
          href: NEW_PAYMENT_LINK_HREF,
          done: created,
        },
        {
          title: 'Share the link',
          body: 'Copy it and send it, or open it yourself to pay in test mode.',
          href: '/app/payment-sessions',
          done: paid,
        },
        {
          title: 'See the payment land',
          body: 'It shows up in Transactions seconds after it settles, in your own wallet.',
          href: '/app/transactions',
          done: paid,
        },
      ],
    },
    {
      id: 'developer',
      label: 'With your developer',
      steps: [
        {
          title: 'Issue your first API key',
          body: 'Test mode is free. Live mode unlocks after MFA and email verification.',
          href: '/app/api-keys',
          done: false,
        },
        {
          title: 'Send a test payment',
          body: 'Create a test session from code, complete the hosted checkout, watch it confirm.',
          href: '/app/payment-sessions',
          done: paid,
        },
        {
          title: 'Wire a webhook',
          body: 'Add an HTTPS endpoint and send a test event to check your handler.',
          href: '/app/webhooks',
          done: false,
        },
      ],
    },
  ]
}

export function shouldOpenNew(params: URLSearchParams): boolean {
  return params.get('new') === '1'
}
