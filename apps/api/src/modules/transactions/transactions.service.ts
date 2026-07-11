import { Injectable, NotFoundException } from '@nestjs/common'
import type { Mode, Transaction } from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async retrieve(merchantId: string, mode: Mode, id: string): Promise<Transaction> {
    const row = await this.prisma.db.transaction.findFirst({ where: { id, merchantId, mode } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'transaction not found' })
    return serialise(row)
  }

  async list(
    merchantId: string,
    mode: Mode,
    params: { limit?: number; cursor?: string | null; kind?: string; status?: string },
  ) {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.transaction.findMany({
      where: {
        merchantId,
        mode,
        kind: (params.kind as never) ?? undefined,
        status: (params.status as never) ?? undefined,
      },
      orderBy: { blockTimestamp: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialise)
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function serialise(row: any): Transaction {
  return {
    ...row,
    blockNumber: Number(row.blockNumber),
    blockTimestamp: row.blockTimestamp.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}
