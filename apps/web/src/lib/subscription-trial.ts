import type { SubscriptionEnrolmentTerms } from '@strimz/shared-types'

export interface TrialCopy {
  notice: string
  button: string
  confirmed: string
}

export function trialCopy(
  terms: SubscriptionEnrolmentTerms,
  price: string,
  intervalLabel: string,
  locale?: string,
): TrialCopy {
  if (terms.trialDays === 0 || terms.trialEndsAt === null) {
    return {
      notice: `You are charged ${price} today, then every ${intervalLabel}.`,
      button: `Subscribe. ${price}/${intervalLabel}`,
      confirmed:
        'Your first charge has been recorded on-chain. Strimz will charge automatically each period. Cancel anytime.',
    }
  }
  const firstCharge = new Date(terms.trialEndsAt).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const days = terms.trialDays === 1 ? '1-day' : `${terms.trialDays}-day`
  return {
    notice: `${days} free trial. Nothing is charged today. Your first charge of ${price} is on ${firstCharge}, then every ${intervalLabel}.`,
    button: `Start ${days} free trial`,
    confirmed: `Your free trial has started. Your first charge of ${price} is on ${firstCharge}. Cancel anytime before then.`,
  }
}
