import { Injectable, NotFoundException } from '@nestjs/common'
import type { Mode, Transaction } from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import type { TransactionKind, TransactionStatus } from '@strimz/db'
import { anyOf } from '../../common/schemas/list-query.js'

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async retrieve(merchantId: string, mode: Mode, id: string): Promise<Transaction> {
    const row = await this.prisma.db.transaction.findFirst({
      where: { id, merchantId, mode },
      include: FEE_REFUND,
    })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'transaction not found' })
    return serialise(row)
  }

  async list(
    merchantId: string,
    mode: Mode,
    params: {
      limit?: number
      cursor?: string | null
      kind?: TransactionKind[]
      status?: TransactionStatus[]
      sessionId?: string
      subscriptionId?: string
      customerId?: string
      blockTimestamp?: { gte?: Date; lt?: Date }
    },
  ) {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.transaction.findMany({
      where: {
        merchantId,
        mode,
        kind: anyOf(params.kind),
        status: anyOf(params.status),
        sessionId: params.sessionId,
        subscriptionId: params.subscriptionId,
        customerId: params.customerId,
        blockTimestamp: params.blockTimestamp,
      },
      include: FEE_REFUND,
      orderBy: { blockTimestamp: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialise)
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }
}

const FEE_REFUND = {
  feeRefund: {
    select: { amount: true, status: true, transfer: { select: { txHash: true } } },
  },
} as const

/* eslint-disable @typescript-eslint/no-explicit-any */
function serialise(row: any): Transaction {
  const { feeRefund, ...rest } = row
  return {
    ...rest,
    blockNumber: Number(row.blockNumber),
    blockTimestamp: row.blockTimestamp.toISOString(),
    createdAt: row.createdAt.toISOString(),
    feeRefund: feeRefund
      ? {
          amount: feeRefund.amount,
          status: feeRefund.status,
          txHash: feeRefund.transfer?.txHash ?? null,
        }
      : null,
  }
}
