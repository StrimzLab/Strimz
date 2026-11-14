import { PLANS } from '@strimz/shared-config'

export const SUPPORT_EMAIL = 'support@strimz.finance'

export function mailto(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
}

export const CONTACT_TOPICS = [
  {
    label: 'Sales',
    subject: 'Sales',
    body: 'Pricing, plans, Enterprise rates and contracts.',
  },
  {
    label: 'Support',
    subject: 'Support',
    body: 'Bugs, integration questions, anything urgent in your dashboard.',
  },
  {
    label: 'Security',
    subject: 'Security',
    body: 'Responsible disclosure. We reply privately.',
  },
] as const

export const DEMO_MAILTO = mailto('Demo request')

export const PRIORITY_SUPPORT_PLANS = Object.values(PLANS)
  .filter((plan) => plan.prioritySupport)
  .map((plan) => plan.name)
