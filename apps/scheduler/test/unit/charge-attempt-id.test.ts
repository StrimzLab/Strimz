import { describe, it, expect } from 'vitest'
import { deriveChargeAttemptId } from '../../src/workers/subscription-due/subscription-due.worker.js'

describe('deriveChargeAttemptId', () => {
  it('is deterministic for the same (subId, periodEnd, attempt)', () => {
    const periodEnd = new Date('2026-05-01T00:00:00Z')
    const a = deriveChargeAttemptId(7, periodEnd, 0)
    const b = deriveChargeAttemptId(7, periodEnd, 0)
    expect(a).toBe(b)
    expect(a).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('differs across distinct subscriptions', () => {
    const periodEnd = new Date('2026-05-01T00:00:00Z')
    expect(deriveChargeAttemptId(1, periodEnd, 0)).not.toBe(deriveChargeAttemptId(2, periodEnd, 0))
  })

  it('differs across distinct periods of the same sub', () => {
    expect(deriveChargeAttemptId(1, new Date('2026-05-01T00:00:00Z'), 0)).not.toBe(
      deriveChargeAttemptId(1, new Date('2026-06-01T00:00:00Z'), 0),
    )
  })

  it('differs across retry attempts within the same period', () => {
    const periodEnd = new Date('2026-05-01T00:00:00Z')
    expect(deriveChargeAttemptId(1, periodEnd, 0)).not.toBe(deriveChargeAttemptId(1, periodEnd, 1))
  })
})
