import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { Prisma } from '@strimz/db'
import { uuid } from '@strimz/shared-crypto'
import { webhookEventSchema } from '@strimz/shared-types'
import { ZodError } from 'zod'
import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../prisma/prisma.service.js'
import {
  QUEUE_NAMES,
  webhookDeliveryJobSchema,
  type WebhookDeliveryJob,
} from '@strimz/queue-contracts'
import { outboxRefSchema, readOutboxRef, type OutboxRef } from './outbox-ref.js'
import {
  serialiseCharge,
  serialiseInvoice,
  serialiseRefund,
  serialiseSession,
  serialiseSubscription,
  serialiseTransaction,
} from './serialisers.js'

const API_VERSION = '2026-04-27'
const BATCH = 100

type EventRow = {
  id: string
  merchantId: string
  type: string
  mode: 'test' | 'live'
  payload: unknown
  createdAt: Date
}

function isPermanentDispatchFailure(err: unknown): boolean {
  if (err instanceof ZodError) return true
  if (err instanceof Prisma.PrismaClientValidationError) return true
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025'
}

/**
 * Transactional-outbox dispatcher.
 *
 * Producers (apps/api, the Go indexer, other crons) write a WebhookEvent
 * with `dispatchedAt` NULL. Each event is claimed, hydrated, validated and
 * given its WebhookDelivery rows in one transaction; the delivery jobs are
 * enqueued after it commits.
 *
 * One dispatch path for every event source, so a payload can never be
 * "written but never delivered" again.
 */
@Injectable()
export class WebhookOutboxService {
  private readonly log = new Logger(WebhookOutboxService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: TypedConfigService,
    @InjectQueue(QUEUE_NAMES.webhookDelivery)
    private readonly deliveryQueue: Queue,
  ) {}

  @Interval('webhook-outbox', 4_000)
  tick(): Promise<{ dispatched: number; deliveriesQueued: number }> {
    return this.tickNow()
  }

  async tickNow(): Promise<{ dispatched: number; deliveriesQueued: number }> {
    const attempted: string[] = []
    let deliveriesQueued = 0
    while (attempted.length < BATCH) {
      const outcome = await this.dispatchNext(attempted)
      if (!outcome) break
      attempted.push(outcome.eventId)
      deliveriesQueued += outcome.deliveriesQueued
    }

    if (attempted.length === 0) return { dispatched: 0, deliveriesQueued: 0 }
    this.log.log(`dispatched ${attempted.length} events, queued ${deliveriesQueued} deliveries`)
    return { dispatched: attempted.length, deliveriesQueued }
  }

  // The claim commits together with the envelope and delivery rows, so a scheduler that
  // dies mid-dispatch leaves the event unclaimed. Jobs are queued after the commit; if the
  // process dies before that, webhook-recovery re-queues the pending deliveries.
  private async dispatchNext(
    skip: string[],
  ): Promise<{ eventId: string; deliveriesQueued: number } | null> {
    const claim: { event?: EventRow } = {}
    let jobs: WebhookDeliveryJob[]
    try {
      jobs = await this.prisma.db.$transaction(async (db) => {
        // A row another dispatcher committed after this statement's snapshot fails the
        // recheck and empties the LIMIT 1 result, so an empty read is retried once.
        const event = (await this.lockNext(db, skip)) ?? (await this.lockNext(db, skip))
        if (!event) return []
        claim.event = event
        const envelope = await this.buildEnvelope(event)
        const { type: wireType } = webhookEventSchema.parse(envelope)
        await db.webhookEvent.update({
          where: { id: event.id },
          data: { payload: envelope as never, dispatchError: null, dispatchedAt: new Date() },
        })
        return this.createDeliveries(db, event, wireType)
      })
    } catch (err) {
      const event = claim.event
      if (!event) throw err
      const message = (err as Error).message.slice(0, 1_000)
      const permanent = isPermanentDispatchFailure(err)
      this.log.error(
        `event ${event.id} (${event.type}) failed to dispatch (${permanent ? 'quarantined' : 'will retry'}): ${message}`,
      )
      await this.prisma.db.webhookEvent.update({
        where: { id: event.id },
        data: permanent
          ? { dispatchError: message, dispatchedAt: new Date() }
          : { dispatchError: message },
      })
      return { eventId: event.id, deliveriesQueued: 0 }
    }

    const event = claim.event
    if (!event) return null
    for (const job of jobs) {
      await this.deliveryQueue.add('deliver', job, {
        attempts: 1,
        removeOnComplete: 1_000,
        removeOnFail: 1_000,
      })
    }
    return { eventId: event.id, deliveriesQueued: jobs.length }
  }

  private async lockNext(
    db: Prisma.TransactionClient,
    skip: string[],
  ): Promise<EventRow | undefined> {
    const rows = await db.$queryRaw<EventRow[]>`
      SELECT id, "merchantId", type::text AS type, mode::text AS mode, payload, "createdAt"
        FROM "WebhookEvent"
       WHERE "dispatchedAt" IS NULL AND id <> ALL(${skip}::text[])
       ORDER BY "createdAt"
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    return rows[0]
  }

  /** Build the final envelope: hydrate ref-payloads, pass full ones through. */
  private async buildEnvelope(ev: EventRow): Promise<unknown> {
    const rawRef = readOutboxRef(ev.payload)
    if (!rawRef) {
      // Already a full envelope (apps/api / crons build inline).
      return ev.payload
    }
    const ref = outboxRefSchema.parse(rawRef)
    const data = await this.hydrate(ref)
    return {
      id: ev.id,
      type: ref.kind,
      apiVersion: API_VERSION,
      mode: ev.mode,
      createdAt: ev.createdAt.toISOString(),
      data,
    }
  }

  private async hydrate(ref: OutboxRef): Promise<unknown> {
    const usdc = this.cfg.env.ARC_USDC_ADDRESS ?? null
    switch (ref.kind) {
      case 'payment.completed': {
        const [session, transaction] = await Promise.all([
          this.prisma.db.paymentSession.findUniqueOrThrow({
            where: { id: ref.sessionId },
            include: { merchant: true },
          }),
          this.prisma.db.transaction.findUniqueOrThrow({ where: { id: ref.transactionId } }),
        ])
        return {
          session: serialiseSession(session, usdc),
          transaction: serialiseTransaction(transaction),
        }
      }
      case 'invoice.paid': {
        const [invoice, transaction] = await Promise.all([
          this.prisma.db.invoice.findUniqueOrThrow({ where: { id: ref.invoiceId } }),
          this.prisma.db.transaction.findUniqueOrThrow({ where: { id: ref.transactionId } }),
        ])
        return {
          invoice: serialiseInvoice(invoice),
          transaction: serialiseTransaction(transaction),
        }
      }
      case 'subscription.created': {
        const sub = await this.prisma.db.subscription.findUniqueOrThrow({
          where: { id: ref.subscriptionId },
        })
        return serialiseSubscription(sub)
      }
      case 'subscription.charged': {
        const [sub, charge, transaction] = await Promise.all([
          this.prisma.db.subscription.findUniqueOrThrow({ where: { id: ref.subscriptionId } }),
          this.prisma.db.subscriptionCharge.findUniqueOrThrow({ where: { id: ref.chargeId } }),
          this.prisma.db.transaction.findUniqueOrThrow({ where: { id: ref.transactionId } }),
        ])
        return {
          subscription: serialiseSubscription(sub),
          charge: serialiseCharge(charge),
          transaction: serialiseTransaction(transaction),
        }
      }
      case 'subscription.charge_failed': {
        const [sub, charge] = await Promise.all([
          this.prisma.db.subscription.findUniqueOrThrow({ where: { id: ref.subscriptionId } }),
          this.prisma.db.subscriptionCharge.findUniqueOrThrow({ where: { id: ref.chargeId } }),
        ])
        return { subscription: serialiseSubscription(sub), charge: serialiseCharge(charge) }
      }
      case 'refund.failed': {
        const refund = await this.prisma.db.refund.findUniqueOrThrow({
          where: { id: ref.refundId },
        })
        return serialiseRefund(refund)
      }
      case 'refund.completed': {
        const refund = await this.prisma.db.refund.findUniqueOrThrow({
          where: { id: ref.refundId },
        })
        const transaction = await this.prisma.db.transaction.findUniqueOrThrow({
          where: { id: refund.transactionId },
        })
        return { refund: serialiseRefund(refund), transaction: serialiseTransaction(transaction) }
      }
      case 'subscription.lapsed':
      case 'subscription.reactivated': {
        const sub = await this.prisma.db.subscription.findUniqueOrThrow({
          where: { id: ref.subscriptionId },
        })
        return serialiseSubscription(sub)
      }
      case 'subscription.recovery_attempt': {
        const sub = await this.prisma.db.subscription.findUniqueOrThrow({
          where: { id: ref.subscriptionId },
        })
        return { subscription: serialiseSubscription(sub), attemptNumber: ref.attemptNumber }
      }
      case 'invoice.overdue': {
        const invoice = await this.prisma.db.invoice.findUniqueOrThrow({
          where: { id: ref.invoiceId },
        })
        return serialiseInvoice(invoice)
      }
      case 'payment.failed': {
        const session = await this.prisma.db.paymentSession.findUniqueOrThrow({
          where: { id: ref.sessionId },
          include: { merchant: true },
        })
        return { session: serialiseSession(session, usdc), reason: ref.reason ?? 'failed' }
      }
    }
  }

  private async createDeliveries(
    db: Prisma.TransactionClient,
    ev: EventRow,
    wireType: string,
  ): Promise<WebhookDeliveryJob[]> {
    const prismaEventName = wireType.replace(/\./g, '_')
    const endpoints = await db.merchantWebhookEndpoint.findMany({
      where: {
        merchantId: ev.merchantId,
        mode: ev.mode,
        status: 'active',
        events: { has: prismaEventName as never },
      },
    })
    const jobs: WebhookDeliveryJob[] = []
    for (const ep of endpoints) {
      const deliveryId = `whdl_${uuid()}`
      await db.webhookDelivery.create({
        data: {
          id: deliveryId,
          deliveryId,
          merchantId: ev.merchantId,
          endpointId: ep.id,
          eventId: ev.id,
          eventName: prismaEventName as never,
          status: 'pending',
          attempt: 1,
        },
      })
      jobs.push(
        webhookDeliveryJobSchema.parse({
          deliveryId,
          endpointId: ep.id,
          url: ep.url,
          signingSecretHash: ep.signingSecretHash,
          eventId: ev.id,
        }),
      )
    }
    return jobs
  }
}
