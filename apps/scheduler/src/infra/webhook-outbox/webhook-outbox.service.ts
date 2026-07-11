import { Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
import { uuid } from '@strimz/shared-crypto'
import { webhookEventSchema } from '@strimz/shared-types'
import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { QUEUE_NAMES } from '../queue/queue-names.js'
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
  payload: any
  createdAt: Date
}

/**
 * Transactional-outbox dispatcher.
 *
 * Producers (apps/api, the Go indexer, other crons) write a WebhookEvent
 * with `dispatchedAt` NULL. This claims undispatched events, hydrates
 * ref-payloads into full envelopes, validates against the shared schema,
 * creates WebhookDelivery rows, and enqueues the delivery jobs.
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
  async tick(): Promise<{ dispatched: number; deliveriesQueued: number }> {
    return this.tickNow()
  }

  async tickNow(): Promise<{ dispatched: number; deliveriesQueued: number }> {
    // Claim a batch atomically so multiple replicas never grab the same row.
    const claimed = (await this.prisma.db.$queryRawUnsafe(
      `UPDATE "WebhookEvent" SET "dispatchedAt" = NOW()
         WHERE id IN (
           SELECT id FROM "WebhookEvent"
            WHERE "dispatchedAt" IS NULL AND "dispatchError" IS NULL
            ORDER BY "createdAt"
            LIMIT ${BATCH}
            FOR UPDATE SKIP LOCKED
         )
       RETURNING id, "merchantId", type::text AS type, mode::text AS mode, payload, "createdAt"`,
    )) as EventRow[]

    if (claimed.length === 0) return { dispatched: 0, deliveriesQueued: 0 }

    let deliveriesQueued = 0
    for (const ev of claimed) {
      try {
        const envelope = await this.buildEnvelope(ev)
        webhookEventSchema.parse(envelope)
        // Persist the final envelope so the delivery worker sends it verbatim.
        await this.prisma.db.webhookEvent.update({
          where: { id: ev.id },
          data: { payload: envelope as never },
        })
        deliveriesQueued += await this.createDeliveries(ev, envelope.type)
      } catch (err) {
        const message = (err as Error).message.slice(0, 1_000)
        this.log.error(`event ${ev.id} (${ev.type}) failed to dispatch: ${message}`)
        await this.prisma.db.webhookEvent.update({
          where: { id: ev.id },
          data: { dispatchError: message },
        })
      }
    }

    this.log.log(`dispatched ${claimed.length} events, queued ${deliveriesQueued} deliveries`)
    return { dispatched: claimed.length, deliveriesQueued }
  }

  /** Build the final envelope: hydrate ref-payloads, pass full ones through. */
  private async buildEnvelope(ev: EventRow): Promise<{ type: string; [k: string]: unknown }> {
    const ref = ev.payload?.ref
    if (!ref) {
      // Already a full envelope (apps/api / crons build inline).
      return ev.payload
    }
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

  private async hydrate(ref: any): Promise<unknown> {
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
      case 'refund.completed': {
        const refund = await this.prisma.db.refund.findUniqueOrThrow({
          where: { id: ref.refundId },
        })
        const transaction = await this.prisma.db.transaction.findUniqueOrThrow({
          where: { id: refund.transactionId },
        })
        return { refund: serialiseRefund(refund), transaction: serialiseTransaction(transaction) }
      }
      case 'subscription.lapsed': {
        const sub = await this.prisma.db.subscription.findUniqueOrThrow({
          where: { id: ref.subscriptionId },
        })
        return serialiseSubscription(sub)
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
        return { session: serialiseSession(session, usdc), reason: String(ref.reason ?? 'failed') }
      }
      default:
        throw new Error(`unknown ref kind: ${ref.kind}`)
    }
  }

  private async createDeliveries(ev: EventRow, wireType: string): Promise<number> {
    const prismaEventName = wireType.replace(/\./g, '_')
    const endpoints = await this.prisma.db.merchantWebhookEndpoint.findMany({
      where: {
        merchantId: ev.merchantId,
        mode: ev.mode,
        status: 'active',
        events: { has: prismaEventName as never },
      },
    })
    for (const ep of endpoints) {
      const deliveryId = `whdl_${uuid()}`
      await this.prisma.db.webhookDelivery.create({
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
      await this.deliveryQueue.add(
        'deliver',
        {
          deliveryId,
          endpointId: ep.id,
          url: ep.url,
          signingSecretHash: ep.signingSecretHash,
          eventId: ev.id,
        },
        { attempts: 1, removeOnComplete: 1_000, removeOnFail: 1_000 },
      )
    }
    return endpoints.length
  }
}
