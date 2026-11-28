import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import {
  QUEUE_NAMES,
  relayJobSchema,
  relaySubmissionJobOptions,
  type RelayJob,
} from '@strimz/queue-contracts'
import { TypedConfigService } from '../../config/index.js'
import { EmailService } from '../../infra/email/email.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { RedisService } from '../../infra/redis/redis.service.js'

const RETRY_AFTER_MS = 10 * 60_000
const BATCH = 25
/** Six sweeps, ten minutes apart: an hour of retries before ops hear about it. */
const ALERT_AFTER_ATTEMPTS = 6
const DAY_SECONDS = 86_400

/**
 * Re-queues merchant registrations that never landed (ADR-2026-11-28-registration-retry).
 * The relay runner decides whether sending again is safe; this only makes sure it gets asked.
 */
@Injectable()
export class RegistrationRetryService {
  private readonly log = new Logger(RegistrationRetryService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly email: EmailService,
    private readonly cfg: TypedConfigService,
    @InjectQueue(QUEUE_NAMES.relaySubmission)
    private readonly relayQueue: Queue,
  ) {}

  @Cron(process.env.REGISTRATION_RETRY_CRON || '0 */10 * * * *', { name: 'registration-retry' })
  sweep(): Promise<{ requeued: number; alerted: number }> {
    return this.sweepNow()
  }

  async sweepNow(now = new Date()): Promise<{ requeued: number; alerted: number }> {
    const stuck = await this.prisma.db.merchant.findMany({
      where: {
        onboardingCompleted: true,
        onchainMerchantId: null,
        walletAddress: { not: null },
        payoutAddress: { not: null },
        OR: [
          { onchainRegistrationRequestedAt: null },
          { onchainRegistrationRequestedAt: { lt: new Date(now.getTime() - RETRY_AFTER_MS) } },
        ],
      },
      orderBy: { onchainRegistrationRequestedAt: { sort: 'asc', nulls: 'first' } },
      take: BATCH,
      select: { id: true, onchainRegistrationTxHash: true },
    })

    let alerted = 0
    for (const m of stuck) {
      await this.requeue(m.id, await this.bookedDelayMs(m.id, now))
      await this.prisma.db.merchant.update({
        where: { id: m.id },
        data: { onchainRegistrationRequestedAt: now },
      })
      if (await this.alertIfStuck(m.id, m.onchainRegistrationTxHash)) alerted++
    }
    if (stuck.length > 0)
      this.log.log(`registration-retry: requeued=${stuck.length} alerted=${alerted}`)
    return { requeued: stuck.length, alerted }
  }

  private async requeue(merchantId: string, delayMs: number): Promise<void> {
    const job: RelayJob = relayJobSchema.parse({
      reason: 'registerMerchant',
      idempotencyKey: `merchant-register-${merchantId}`,
      merchantInternalId: merchantId,
    })
    const existing = await this.relayQueue.getJob(job.idempotencyKey)
    if (existing && (await existing.getState()) === 'failed') await existing.remove()
    await this.relayQueue.add(
      `relay:${job.reason}`,
      job,
      relaySubmissionJobOptions(job.idempotencyKey, delayMs),
    )
  }

  /**
   * The day the API booked under the daily registration cap. No booking means it expired after
   * the merchant's slot was used, so the retry goes now without taking another.
   */
  private async bookedDelayMs(merchantId: string, now: Date): Promise<number> {
    const day = await this.redis.client.get(`relay:registration:${merchantId}`)
    if (!day) return 0
    return Math.max(0, new Date(`${day}T00:00:00.000Z`).getTime() - now.getTime())
  }

  private async alertIfStuck(merchantId: string, txHash: string | null): Promise<boolean> {
    const attemptsKey = `registration-retry:attempts:${merchantId}`
    const attempts = await this.redis.client.incr(attemptsKey)
    await this.redis.client.expire(attemptsKey, DAY_SECONDS)
    if (attempts < ALERT_AFTER_ATTEMPTS) return false
    const first = await this.redis.client.set(
      `alert:registration-stuck:${merchantId}`,
      '1',
      'EX',
      DAY_SECONDS,
      'NX',
    )
    if (first !== 'OK') return false
    try {
      await this.email.send({
        to: this.cfg.env.STRIMZ_ADMIN_ALERT_EMAIL,
        subject: `[Strimz] Merchant registration stuck for an hour`,
        html: `<p>Merchant <code>${merchantId}</code> has been onboarded for over an hour but isn't registered on-chain.</p><p>Last registration transaction: <code>${txHash ?? 'none sent'}</code>. Check the relayer's balance and role, and the API logs for <code>merchant-register-${merchantId}</code>.</p>`,
      })
      return true
    } catch (err) {
      this.log.error(`registration-retry alert failed: ${(err as Error).message}`)
      return false
    }
  }
}
