import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { CancelSubscriptionInput, Subscription } from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { QueueService, QUEUE_NAMES } from '../../infra/queue/queue.service.js'
import { WebhookEventService } from '../../infra/events/webhook-event.service.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

@Injectable()
export class SubscriptionsService {
  private readonly log = new Logger(SubscriptionsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly events: WebhookEventService,
  ) {}

  async retrieve(merchantId: string, id: string): Promise<Subscription> {
    const row = await this.prisma.db.subscription.findFirst({ where: { id, merchantId } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'subscription not found' })
    return serialise(row)
  }

  async list(
    merchantId: string,
    params: { limit?: number; cursor?: string | null; status?: string; planId?: string },
  ) {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.subscription.findMany({
      where: {
        merchantId,
        status: (params.status as never) ?? undefined,
        planId: params.planId ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialise)
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }

  /**
   * Cancellation flow.
   *
   * 1. Validate the subscription exists and is owned by the merchant.
   * 2. Validate it is not already cancelled / lapsed.
   * 3. Mark `cancelled` in DB optimistically.
   * 4. Enqueue an on-chain cancel job onto the agent action queue (the
   *    scheduler signs and broadcasts the contract call).
   * 5. Fire `subscription.cancelled` webhook.
   *
   * If the on-chain cancel fails, the agent worker reverts the DB flag
   * and surfaces the failure via `subscription.charge_failed` (the reason
   * field carries the cause). This avoids the race where a charge runs
   * after the off-chain mark-cancelled but before the on-chain cancel
   * lands; the contract's `requireActiveMerchant` + `cancelled` storage
   * is the final source of truth.
   */
  async cancel(merchantId: string, input: CancelSubscriptionInput): Promise<Subscription> {
    const sub = await this.prisma.db.subscription.findFirst({
      where: { id: input.id, merchantId },
    })
    if (!sub) throw new NotFoundException({ code: 'not_found', message: 'subscription not found' })
    if (sub.status === 'cancelled' || sub.status === 'lapsed') {
      throw new ForbiddenException({
        code: 'session_invalid_state',
        message: `subscription is already ${sub.status}`,
      })
    }

    const cancelled = await this.prisma.db.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancellationReason: input.reason ?? null,
      },
    })

    // Enqueue on-chain cancel — the scheduler / agent worker holds the only
    // signing key the API ever talks to.
    await this.queue.queue(QUEUE_NAMES.agentAction).add('subscription.cancel-onchain', {
      subscriptionId: sub.id,
      onchainSubscriptionId: sub.onchainSubscriptionId,
      merchantId,
      reason: input.reason ?? null,
    })

    // Awaited so the WebhookEvent + WebhookDelivery rows exist before the API
    // returns 201 — merchants who immediately query event/delivery feeds see
    // the cancellation. Failures don't fail the cancel (DB state is final);
    // the agent worker's retry path will redrive any stuck deliveries.
    await this.events
      .fire({
        merchantId,
        mode: sub.mode as 'test' | 'live',
        name: 'subscription.cancelled',
        data: serialise(cancelled),
      })
      .catch((err: unknown) => this.log.warn(`webhook fire failed: ${(err as Error).message}`))

    return serialise(cancelled)
  }
}

function serialise(row: any): Subscription {
  return {
    id: row.id,
    onchainSubscriptionId: row.onchainSubscriptionId,
    merchantId: row.merchantId,
    customerId: row.customerId,
    planId: row.planId,
    status: row.status,
    payerAddress: row.payerAddress,
    currency: row.currency,
    amount: row.amount,
    interval: row.interval,
    intervalCount: row.intervalCount,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    currentPeriodStartAt: row.currentPeriodStartAt.toISOString(),
    currentPeriodEndAt: row.currentPeriodEndAt.toISOString(),
    nextChargeAt: row.nextChargeAt?.toISOString() ?? null,
    gracePeriodHours: row.gracePeriodHours,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } as Subscription
}
