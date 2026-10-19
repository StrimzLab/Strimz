import { describe, expect, it } from 'vitest'
import { HOW_IT_WORKS, STEP_LABELS, busyLabel, intervalLabel, phaseLine } from '@/lib/checkout-copy'

const JARGON =
  /signature|\bsign\b|settle|on-chain|onchain|transaction|gas|reown|appkit|authorization/iu

const PHASES = [
  'loading',
  'connect',
  'ready',
  'signing',
  'submitting',
  'polling',
  'confirmed',
  'already_subscribed',
] as const

describe('checkout copy', () => {
  it.each(PHASES)('describes %s without protocol words', (phase) => {
    for (const flow of ['pay', 'subscribe'] as const) {
      expect(phaseLine(phase, flow)).not.toMatch(JARGON)
    }
  })

  it.each(['loading', 'signing', 'submitting', 'polling'] as const)(
    'labels the %s spinner in plain words',
    (phase) => {
      expect(busyLabel(phase)).not.toMatch(JARGON)
    },
  )

  it('names the two steps Approve and Processing', () => {
    expect(STEP_LABELS).toEqual(['Approve', 'Processing'])
  })

  it.each(['pay', 'subscribe'] as const)('explains %s without protocol words', (flow) => {
    expect(HOW_IT_WORKS[flow].join(' ')).not.toMatch(JARGON)
  })

  it('never promises a cancel from the wallet', () => {
    expect(phaseLine('ready', 'subscribe')).not.toMatch(/from your wallet/u)
  })
})

describe('intervalLabel', () => {
  it.each([
    ['daily', 'day'],
    ['weekly', 'week'],
    ['monthly', 'month'],
    ['quarterly', 'quarter'],
    ['yearly', 'year'],
    [null, 'period'],
  ] as const)('%s is %s', (interval, label) => {
    expect(intervalLabel(interval)).toBe(label)
  })
})
