import { describe, expect, it } from 'vitest'

import { buildPlanInput } from '@/lib/plan-input'

const base = {
  name: 'Pro',
  description: '',
  amount: '29',
  currency: 'USDC' as const,
  interval: 'monthly' as const,
  intervalCount: '',
  trialDays: '',
}

describe('buildPlanInput', () => {
  it('builds the smallest plan, billed every interval with no trial', () => {
    expect(buildPlanInput(base)).toEqual({
      ok: true,
      input: {
        name: 'Pro',
        amount: '29000000',
        currency: 'USDC',
        interval: 'monthly',
        intervalCount: 1,
      },
    })
  })

  it('keeps the description, interval count and trial, trimmed', () => {
    expect(
      buildPlanInput({
        ...base,
        name: '  Team ',
        description: ' For small teams ',
        currency: 'EURC',
        interval: 'weekly',
        intervalCount: '2',
        trialDays: '14',
      }),
    ).toEqual({
      ok: true,
      input: {
        name: 'Team',
        description: 'For small teams',
        amount: '29000000',
        currency: 'EURC',
        interval: 'weekly',
        intervalCount: 2,
        trialPeriodDays: 14,
      },
    })
  })

  it('keeps an explicit zero-day trial out of the request', () => {
    expect(buildPlanInput({ ...base, trialDays: '0' })).toEqual(buildPlanInput(base))
  })

  it.each([
    ['', 'Enter a plan name'],
    ['x'.repeat(121), 'Plan name must be 120 characters or fewer'],
  ])('refuses the name %j', (name, error) => {
    expect(buildPlanInput({ ...base, name })).toEqual({ ok: false, error })
  })

  it.each([
    ['', 'Enter a price'],
    ['0.5', 'Enter at least 1 USDC'],
    ['1.0000001', 'Enter at most 6 decimal places'],
  ])('refuses the price %j', (amount, error) => {
    expect(buildPlanInput({ ...base, amount })).toEqual({ ok: false, error })
  })

  it.each(['0', '366', '1.5', 'two'])('refuses the interval count %j', (intervalCount) => {
    expect(buildPlanInput({ ...base, intervalCount })).toEqual({
      ok: false,
      error: 'Bill every must be a whole number from 1 to 365',
    })
  })

  it.each(['-1', '366', '7.5', 'week'])('refuses the trial %j', (trialDays) => {
    expect(buildPlanInput({ ...base, trialDays })).toEqual({
      ok: false,
      error: 'Trial must be a whole number of days from 0 to 365',
    })
  })

  it('refuses a description over 500 characters', () => {
    expect(buildPlanInput({ ...base, description: 'x'.repeat(501) })).toEqual({
      ok: false,
      error: 'Description must be 500 characters or fewer',
    })
  })
})
