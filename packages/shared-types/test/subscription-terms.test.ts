import { describe, expect, it } from 'vitest'
import { subscriptionEnrolmentTermsSchema } from '../src/index.js'

describe('subscription enrolment terms', () => {
  it('accepts a trial and an immediate start', () => {
    expect(
      subscriptionEnrolmentTermsSchema.parse({
        startAt: '1790000000',
        trialDays: 14,
        trialEndsAt: '2026-09-21T11:33:20.000Z',
      }).trialDays,
    ).toBe(14)
    expect(
      subscriptionEnrolmentTermsSchema.parse({ startAt: '0', trialDays: 0, trialEndsAt: null })
        .startAt,
    ).toBe('0')
  })

  it('rejects a non-numeric start and a negative trial', () => {
    expect(
      subscriptionEnrolmentTermsSchema.safeParse({
        startAt: 'soon',
        trialDays: 0,
        trialEndsAt: null,
      }).success,
    ).toBe(false)
    expect(
      subscriptionEnrolmentTermsSchema.safeParse({ startAt: '0', trialDays: -1, trialEndsAt: null })
        .success,
    ).toBe(false)
  })
})
