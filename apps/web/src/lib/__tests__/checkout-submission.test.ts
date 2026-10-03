import { describe, expect, it } from 'vitest'

import { inProgressSubmission } from '../checkout-submission'
import type { RelaySubmissionView } from '../strimz-bff'

const VIEW: RelaySubmissionView = {
  id: 'relay-pay-ab',
  idempotencyKey: 'relay-pay-ab',
  status: 'queued',
  txHash: null,
  reason: 'payWithAuthorization',
  errorReason: null,
  attemptCount: 0,
  enqueuedAt: '2026-10-03T00:00:00.000Z',
}

function conflict(code: string, submission: RelaySubmissionView | null) {
  return {
    code: 'relay_submission_failed',
    message: 'an earlier attempt for this checkout can still land',
    detail: { error: { code, message: 'x', details: { submission } } },
  }
}

describe('inProgressSubmission', () => {
  it('returns the live submission of an attempt_in_progress conflict', () => {
    expect(inProgressSubmission(conflict('attempt_in_progress', VIEW))).toEqual(VIEW)
  })

  it('ignores an attempt_in_progress whose submission already failed', () => {
    expect(
      inProgressSubmission(conflict('attempt_in_progress', { ...VIEW, status: 'failed' })),
    ).toBeNull()
  })

  it('ignores other conflicts and unshaped bodies', () => {
    expect(inProgressSubmission(conflict('already_settled', VIEW))).toBeNull()
    expect(inProgressSubmission(conflict('attempt_in_progress', null))).toBeNull()
    expect(inProgressSubmission({ message: 'submit failed (409)' })).toBeNull()
    expect(inProgressSubmission(null)).toBeNull()
  })
})
