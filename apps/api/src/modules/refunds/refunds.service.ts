import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type {
  CreateRefundInput,
  Mode,
  Refund,
  SubmitRefundSignatureInput,
} from '@strimz/shared-types'
import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { WebhookEventService } from '../../infra/events/webhook-event.service.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface RefundCreateOutput {
  refund: Refund
  /** Wallet-signing instructions the merchant uses to issue the on-chain transfer. */
  signingInstructions: {
    token: string
    to: string
    amount: string
    /** Free-text human-friendly description for wallet UI. */
    note: string
  }
}

@Injectable()
export class RefundsService {
  private readonly log = new Logger(RefundsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: WebhookEventService,
    private readonly cfg: TypedConfigService,
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
    input: CreateRefundInput,
  ): Promise<RefundCreateOutput> {
    const tx = await this.prisma.db.transaction.findFirst({
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

    // Cumulative refund check: existing refunds + this one cannot exceed
    // the original amount. Refund.amount is `varchar(78)` so we sum as
    // BigInt in JS instead of Prisma `_sum` (which only supports numeric).
    const priorRefunds = await this.prisma.db.refund.findMany({
      where: { transactionId: tx.id, status: { in: ['submitted', 'completed'] } },
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

    const refund = await this.prisma.db.refund.create({
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

    void this.events
      .fire({
        merchantId,
        mode: tx.mode as 'test' | 'live',
        name: 'refund.created',
        data: serialise(refund),
      })
      .catch((err) => this.log.warn(`refund.created webhook failed: ${(err as Error).message}`))

    // Map internal currency → ERC20 token address for the wallet UI.
    return {
      refund: serialise(refund),
      signingInstructions: {
        token: this.tokenAddressFor(tx.currency),
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
    params: { limit?: number; cursor?: string | null; status?: string },
  ) {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.refund.findMany({
      where: { merchantId, mode, status: (params.status as never) ?? undefined },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialise)
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }

  /**
   * Merchant has signed and broadcast the on-chain refund tx; record the
   * tx hash and transition the refund. Final `completed` status is written
   * by the indexer when the on-chain ERC20 Transfer is observed.
   */
  async submitSignature(
    merchantId: string,
    mode: Mode,
    input: SubmitRefundSignatureInput,
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
    return serialise(updated)
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
