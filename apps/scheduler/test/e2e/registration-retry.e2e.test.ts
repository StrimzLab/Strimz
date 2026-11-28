import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getQueueToken } from '@nestjs/bullmq'
import { Worker, type Queue } from 'bullmq'
import { QUEUE_NAMES } from '@strimz/queue-contracts'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant } from '../helpers/fixtures.js'
import { RedisService } from '../../src/infra/redis/redis.service.js'
import { RegistrationRetryService } from '../../src/crons/registration-retry/registration-retry.service.js'

// ADR-2026-11-28-registration-retry: re-queue stuck registrations and tell ops.
describe('registration retry sweep', () => {
  let t: TestApp
  let queue: Queue
  let redis: RedisService
  let sweep: RegistrationRetryService
  const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000)

  beforeAll(async () => {
    t = await createTestApp()
    queue = t.app.get(getQueueToken(QUEUE_NAMES.relaySubmission))
    redis = t.app.get(RedisService)
    sweep = t.app.get(RegistrationRetryService)
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    await queue.obliterate({ force: true })
    for (const pattern of [
      'relay:registration:*',
      'registration-retry:*',
      'alert:registration-stuck:*',
    ]) {
      const keys = await redis.client.keys(pattern)
      if (keys.length > 0) await redis.client.del(...keys)
    }
    t.email.reset()
  })
  afterEach(async () => {
    await queue.obliterate({ force: true })
  })

  async function stuck(requestedMinutesAgo: number | null, over: Record<string, unknown> = {}) {
    const m = await seedMerchant(t.prisma.db)
    return t.prisma.db.merchant.update({
      where: { id: m.id },
      data: {
        onboardingCompleted: true,
        walletAddress: '0x00000000000000000000000000000000000000c1',
        onchainRegistrationRequestedAt:
          requestedMinutesAgo === null ? null : minutesAgo(requestedMinutesAgo),
        ...over,
      },
    })
  }

  const jobIds = async () =>
    (await queue.getJobs(['waiting', 'delayed', 'active', 'failed'])).map((j) => j.id)

  it('re-queues an onboarded, unregistered merchant whose request is over 10 minutes old', async () => {
    const m = await stuck(11)
    expect(await sweep.sweepNow()).toMatchObject({ requeued: 1 })
    expect(await jobIds()).toEqual([`merchant-register-${m.id}`])
    const job = await queue.getJob(`merchant-register-${m.id}`)
    expect(job?.data).toEqual({
      reason: 'registerMerchant',
      idempotencyKey: `merchant-register-${m.id}`,
      merchantInternalId: m.id,
    })
    const row = await t.prisma.db.merchant.findUniqueOrThrow({ where: { id: m.id } })
    expect(row.onchainRegistrationRequestedAt?.getTime() ?? 0).toBeGreaterThan(
      minutesAgo(1).getTime(),
    )
  })

  it('leaves fresh requests, registered merchants and unfinished onboarding alone', async () => {
    await stuck(5)
    await stuck(30, { onchainMerchantId: 7 })
    await stuck(30, { onboardingCompleted: false })
    await stuck(30, { walletAddress: null })
    expect(await sweep.sweepNow()).toMatchObject({ requeued: 0 })
    expect(await jobIds()).toEqual([])
  })

  it('clears a failed job so the retry is not swallowed', async () => {
    const m = await stuck(30)
    const id = `merchant-register-${m.id}`
    await queue.add('relay:registerMerchant', { stale: true }, { jobId: id })
    // Pick it up by hand and fail it, as the API's relay worker does on a revert.
    const worker = new Worker(QUEUE_NAMES.relaySubmission, null, {
      connection: queue.opts.connection,
    })
    const old = await worker.getNextJob('test-token')
    await old?.moveToFailed(new Error('reverted'), 'test-token', false)
    await worker.close()
    expect(await (await queue.getJob(id))?.getState()).toBe('failed')

    await sweep.sweepNow()

    const job = await queue.getJob(id)
    expect(await job?.getState()).not.toBe('failed')
    expect(job?.data).toMatchObject({ reason: 'registerMerchant' })
  })

  it('keeps a booked cap day as the delay, and retries an expired booking now', async () => {
    const booked = await stuck(30)
    const expired = await stuck(30)
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    await redis.client.set(`relay:registration:${booked.id}`, tomorrow)

    await sweep.sweepNow()

    const later = await queue.getJob(`merchant-register-${booked.id}`)
    const now = await queue.getJob(`merchant-register-${expired.id}`)
    expect(later?.opts.delay).toBeGreaterThan(0)
    expect(now?.opts.delay ?? 0).toBe(0)
  })

  it('re-queues at most 25 per run', async () => {
    for (let i = 0; i < 27; i++) await stuck(30)
    expect(await sweep.sweepNow()).toMatchObject({ requeued: 25 })
  })

  it('alerts ops once a merchant has been retried for an hour, and only once a day', async () => {
    const m = await stuck(30)
    for (let i = 0; i < 6; i++) {
      await t.prisma.db.merchant.update({
        where: { id: m.id },
        data: { onchainRegistrationRequestedAt: minutesAgo(30) },
      })
      await sweep.sweepNow()
    }
    expect(t.email.sent).toHaveLength(1)
    expect(t.email.sent[0]?.subject).toContain('registration')
    expect(t.email.sent[0]?.html).toContain(m.id)

    await t.prisma.db.merchant.update({
      where: { id: m.id },
      data: { onchainRegistrationRequestedAt: minutesAgo(30) },
    })
    await sweep.sweepNow()
    expect(t.email.sent).toHaveLength(1)
  })
})
