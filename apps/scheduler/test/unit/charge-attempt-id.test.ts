import { describe, it, expect } from 'vitest'
import { deriveChargeAttemptId } from '../../src/workers/subscription-due/subscription-due.worker.js'

describe('deriveChargeAttemptId', () => {
  it('is deterministic for the same (subId, periodEnd)', () => {
    const periodEnd = new Date('2026-05-01T00:00:00Z')
    const a = deriveChargeAttemptId(7, periodEnd)
    const b = deriveChargeAttemptId(7, periodEnd)
    expect(a).toBe(b)
    expect(a).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('differs across distinct subscriptions', () => {
    const periodEnd = new Date('2026-05-01T00:00:00Z')
    expect(deriveChargeAttemptId(1, periodEnd)).not.toBe(deriveChargeAttemptId(2, periodEnd))
  })

  it('differs across distinct periods of the same sub', () => {
    expect(deriveChargeAttemptId(1, new Date('2026-05-01T00:00:00Z'))).not.toBe(
      deriveChargeAttemptId(1, new Date('2026-06-01T00:00:00Z')),
    )
  })
})
