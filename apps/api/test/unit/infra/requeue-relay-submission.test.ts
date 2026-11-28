import { describe, expect, it, vi } from 'vitest'
import { QueueService } from '../../../src/infra/queue/queue.service.js'

// ADR-2026-11-28-registration-retry: a failed job must not block the next request for the
// same jobId, but a live or finished attempt must never be duplicated.
const job = {
  reason: 'registerMerchant' as const,
  idempotencyKey: 'merchant-register-m1',
  merchantInternalId: 'm1',
}

function serviceWith(state: string | null) {
  const existing = state
    ? { getState: vi.fn().mockResolvedValue(state), remove: vi.fn().mockResolvedValue(undefined) }
    : undefined
  const queue = {
    getJob: vi.fn().mockResolvedValue(existing),
    add: vi.fn().mockResolvedValue(undefined),
  }
  const service = new QueueService({ client: {} } as never)
  vi.spyOn(service, 'queue').mockReturnValue(queue as never)
  return { service, queue, existing }
}

describe('requeueRelaySubmission', () => {
  it('clears a failed job, then adds the new one', async () => {
    const { service, queue, existing } = serviceWith('failed')
    await service.requeueRelaySubmission(job)
    expect(existing?.remove).toHaveBeenCalledOnce()
    expect(queue.add).toHaveBeenCalledOnce()
  })

  it('adds normally when there is no earlier job', async () => {
    const { service, queue } = serviceWith(null)
    await service.requeueRelaySubmission(job, { delayMs: 5 })
    expect(queue.add).toHaveBeenCalledWith(
      'relay:registerMerchant',
      job,
      expect.objectContaining({ jobId: 'merchant-register-m1', delay: 5 }),
    )
  })

  it.each(['waiting', 'delayed', 'active', 'completed', 'prioritized', 'waiting-children'])(
    'leaves a %s job alone',
    async (state) => {
      const { service, existing } = serviceWith(state)
      await service.requeueRelaySubmission(job)
      expect(existing?.remove).not.toHaveBeenCalled()
    },
  )
})
