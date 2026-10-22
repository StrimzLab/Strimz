// Copied from the dashboard; product-tour.test.ts fails if one is renamed there.
export const TOUR_LABELS = {
  plans: 'Recurring prices your customers subscribe to. Each plan has its own sign-up link.',
  newPlan: 'New plan',
  dialogTitle: 'New subscription plan',
  planName: 'Plan name',
  price: 'Price',
  currency: 'Currency',
  interval: 'Interval',
  createPlan: 'Create plan',
  signUpLink: 'Sign-up link',
  copied: 'Sign-up link copied',
  mrr: 'Monthly recurring revenue',
  subscribers: 'Active subscribers',
  recent: 'Recent activity',
} as const

export const TOUR_STEPS = [
  {
    title: 'Create a plan.',
    body: 'Give it a name and a price, like Team at 80 USDC a month.',
  },
  {
    title: 'Copy its sign-up link.',
    body: 'Send it to customers or put it on your site.',
  },
  {
    title: 'Watch payments arrive.',
    body: 'Each one shows in your dashboard, and monthly recurring revenue updates.',
  },
] as const
