import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type {
  CreateRefundParsed,
  Mode,
  Refund,
  RefundCreateOutput,
  SubmitRefundSignatureParsed,
} from '@strimz/shared-types'
import { TypedConfigService } from '../../config/index.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { WebhookEventService } from '../../infra/events/webhook-event.service.js'
import { Prisma, type RefundStatus } from '@strimz/db'
import { z } from 'zod'
import { anyOf } from '../../common/schemas/list-query.js'
import { TransactionNotFoundError, type Hash } from 'viem'

/* eslint-disable @typescript-eslint/no-explicit-any */

const lockTimeoutCause = z.object({
  driverAdapterError: z.object({ cause: z.object({ originalCode: z.literal('55P03') }) }),
})

function isLockTimeout(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2010' &&
    lockTimeoutCause.safeParse(err.meta).success
  )
}

@Injectable()
export class RefundsService {
  private readonly log = new Logger(RefundsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: WebhookEventService,
    private readonly cfg: TypedConfigService,
    private readonly chain: ChainService,
  ) {}

  private tokenAddressFor(currency: string): string {
    const addr = currency === 'EURC' ? this.cfg.env.ARC_EURC_ADDRESS : this.cfg.env.ARC_USDC_ADDRESS
    if (!addr) {
      throw new BadRequestException({
        code: 'invalid_request',
        message: `no on-chain address configured for ${currency}. Set ARC_${currency}_ADDRESS on the API`,
      })
    }
    return addr
  }

  async create(
    merchantId: string,
    mode: Mode,
    actorId: string,
    input: CreateRefundParsed,
  ): Promise<RefundCreateOutput> {
    const { tx, refund, token } = await this.prisma.db
      .$transaction(async (db) => {
        await db.$executeRaw`SET LOCAL lock_timeout = '5s'`
        // Refunds of one transaction run one at a time, or concurrent requests all pass the cap.
        await db.$queryRaw`SELECT id FROM "Transaction" WHERE id = ${input.transactionId} AND "merchantId" = ${merchantId} FOR UPDATE`

        const tx = await db.transaction.findFirst({
          where: { id: input.transactionId, merchantId, mode },
        })
        if (!tx) {
          throw new NotFoundException({ code: 'not_found', message: 'transaction not found' })
        }
        if (tx.status !== 'confirmed') {
          throw new ForbiddenException({
            code: 'session_invalid_state',
            message: `cannot refund a transaction in status ${tx.status}`,
          })
        }

        // Refund.amount is varchar(78), which Prisma's _sum can't add, so it's summed as BigInt.
        const priorRefunds = await db.refund.findMany({
          where: {
            transactionId: tx.id,
            status: { in: ['pending', 'awaiting_signature', 'submitted', 'completed'] },
          },
          select: { amount: true },
        })
        const priorTotal = priorRefunds.reduce((acc, r) => acc + BigInt(r.amount), 0n)
        const requested = BigInt(input.amount)
        const original = BigInt(tx.amount)
        if (priorTotal + requested > original) {
          throw new BadRequestException({
            code: 'invalid_request',
            message: 'refund amount exceeds remaining refundable balance',
            details: {
              originalAmount: original.toString(),
              priorRefundedTotal: priorTotal.toString(),
              requested: requested.toString(),
            },
          })
        }

        const token = this.tokenAddressFor(tx.currency)

        const refund = await db.refund.create({
          data: {
            merchantId,
            transactionId: tx.id,
            amount: input.amount,
            currency: tx.currency,
            reason: input.reason,
            note: input.note ?? null,
            status: 'awaiting_signature',
            payerAddress: tx.payerAddress,
            initiatedById: actorId,
            mode: tx.mode,
          },
        })
        return { tx, refund, token }
      })
      .catch((err: unknown) => {
        if (isLockTimeout(err)) {
          throw new ConflictException({
            code: 'refund_in_progress',
            message: 'another refund of this transaction is being created; retry shortly',
          })
        }
        throw err
      })

    void this.events
      .fire({
        merchantId,
        mode: tx.mode as 'test' | 'live',
        name: 'refund.created',
        data: serialise(refund),
      })
      .catch((err) => this.log.warn(`refund.created webhook failed: ${(err as Error).message}`))

    return {
      refund: serialise(refund),
      signingInstructions: {
        token,
        to: tx.payerAddress,
        amount: input.amount,
        note: input.note ?? `Refund for transaction ${tx.id}`,
      },
    }
  }

  async retrieve(merchantId: string, mode: Mode, id: string): Promise<Refund> {
    const row = await this.prisma.db.refund.findFirst({ where: { id, merchantId, mode } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'refund not found' })
    return serialise(row)
  }

  async list(
    merchantId: string,
    mode: Mode,
    params: {
      limit?: number
      cursor?: string | null
      status?: RefundStatus[]
      customerId?: string
      createdAt?: { gte?: Date; lt?: Date }
    },
  ) {
    const limit = Math.min(params.limit ?? 25, 100)
    // Refunds don't store the customer; they point at the payment being refunded.
    const transactionId = params.customerId
      ? {
          in: (
            await this.prisma.db.transaction.findMany({
              where: { merchantId, mode, customerId: params.customerId },
              select: { id: true },
            })
          ).map((tx) => tx.id),
        }
      : undefined
    const rows = await this.prisma.db.refund.findMany({
      where: {
        merchantId,
        mode,
        status: anyOf(params.status),
        transactionId,
        createdAt: params.createdAt,
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
   * Records the broadcast refund tx. The indexer or the scheduler's
   * refund-reconciler later completes or fails it from the receipt.
   */
  async submitSignature(
    merchantId: string,
    mode: Mode,
    input: SubmitRefundSignatureParsed,
  ): Promise<Refund> {
    const refund = await this.prisma.db.refund.findFirst({
      where: { id: input.id, merchantId, mode },
    })
    if (!refund) throw new NotFoundException({ code: 'not_found', message: 'refund not found' })
    if (refund.status !== 'awaiting_signature') {
      throw new ForbiddenException({
        code: 'session_invalid_state',
        message: `refund is in status ${refund.status} — cannot accept signature`,
      })
    }

    const updated = await this.prisma.db.refund.update({
      where: { id: refund.id },
      data: { status: 'submitted', refundTxHash: input.refundTxHash },
    })
    const refundTx = await this.sentTransaction(input.refundTxHash as Hash)
    if (!refundTx) return serialise(updated)
    const withTx = await this.prisma.db.refund.update({
      where: { id: refund.id },
      data: { metadata: { ...(updated.metadata as object), refundTx } },
    })
    return serialise(withTx)
  }

  // The reconciler needs the sender and nonce to tell a dropped transaction
  // from a slow one. It looks them up itself if this misses.
  private async sentTransaction(hash: Hash): Promise<{ from: string; nonce: number } | null> {
    try {
      const tx = await this.chain.client.getTransaction({ hash })
      return { from: tx.from.toLowerCase(), nonce: tx.nonce }
    } catch (err) {
      if (!(err instanceof TransactionNotFoundError)) {
        this.log.warn(`refund tx lookup for ${hash} failed: ${(err as Error).message}`)
      }
      return null
    }
  }
}

function serialise(row: any): Refund {
  return {
    id: row.id,
    merchantId: row.merchantId,
    transactionId: row.transactionId,
    amount: row.amount,
    currency: row.currency,
    reason: row.reason,
    note: row.note,
    status: row.status,
    payerAddress: row.payerAddress,
    refundTxHash: row.refundTxHash,
    failureReason: row.failureReason,
    initiatedBy: row.initiatedById,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  } as Refund
}
