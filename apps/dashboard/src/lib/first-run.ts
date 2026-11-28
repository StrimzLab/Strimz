export interface FirstRunProgress {
  /** A payment link or plan exists. */
  created: boolean
  /** At least one payment has confirmed. */
  paid: boolean
  /** Test mode is paid with faucet USDC (ADR-2026-11-26-test-mode). */
  mode?: 'test' | 'live'
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

export function firstRunSteps({ created, paid, mode = 'live' }: FirstRunProgress): FirstRunPath[] {
  const test = mode === 'test'
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
          body: test
            ? 'Copy it and send it. To try it yourself, pay with test USDC from faucet.circle.com.'
            : 'Copy it and send it. To try it yourself, pay a small amount such as 1 USDC.',
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
          body: test
            ? 'Use a test key while you build, and swap in a live key when you launch.'
            : 'Keep the secret key on your server. It is shown only once.',
          href: '/app/api-keys',
          done: false,
        },
        {
          title: 'Make your first payment',
          body: test
            ? 'Create a session from code, pay it with test USDC from the faucet, and watch it confirm.'
            : 'Create a session from code, pay it with a small amount such as 1 USDC, and watch it confirm.',
          href: '/app/payment-sessions',
          done: paid,
        },
        {
          title: 'Wire a webhook',
          body: 'Add an HTTPS endpoint. Your next payment sends it a signed event.',
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
