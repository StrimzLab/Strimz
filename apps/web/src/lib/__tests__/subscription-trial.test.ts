import { describe, expect, it } from 'vitest'
import { trialCopy } from '../subscription-trial'

describe('trialCopy', () => {
  it('says nothing is charged today during a trial and names the first charge date', () => {
    const copy = trialCopy(
      { startAt: '1792108800', trialDays: 14, trialEndsAt: '2026-10-16T12:00:00.000Z' },
      '20 USDC',
      'month',
      'en-GB',
    )
    expect(copy.notice).toBe(
      '14-day free trial. Nothing is charged today. Your first charge of 20 USDC is on 16 October 2026, then every month.',
    )
    expect(copy.button).toBe('Start 14-day free trial')
    expect(copy.confirmed).toContain('16 October 2026')
  })

  it('says the payer is charged today without a trial', () => {
    const copy = trialCopy({ startAt: '0', trialDays: 0, trialEndsAt: null }, '20 USDC', 'month')
    expect(copy.notice).toBe('You are charged 20 USDC today, then every month.')
    expect(copy.button).toBe('Subscribe. 20 USDC/month')
  })

  it('uses the singular for a one-day trial', () => {
    const copy = trialCopy(
      { startAt: '1792108800', trialDays: 1, trialEndsAt: '2026-10-03T12:00:00.000Z' },
      '5 EURC',
      'week',
      'en-GB',
    )
    expect(copy.button).toBe('Start 1-day free trial')
  })
})
