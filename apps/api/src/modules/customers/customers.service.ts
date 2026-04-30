import { Injectable, NotFoundException } from '@nestjs/common'
import type { Customer, UpsertCustomerInput } from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(merchantId: string, input: UpsertCustomerInput): Promise<Customer> {
    const row = await this.prisma.db.customer.upsert({
      where: { merchantId_walletAddress: { merchantId, walletAddress: input.walletAddress } },
      create: {
        merchantId,
        walletAddress: input.walletAddress,
        email: input.email ?? null,
        externalRef: input.externalRef ?? null,
        displayName: input.displayName ?? null,
        metadata: (input.metadata ?? {}) as never,
      },
      update: {
        email: input.email ?? undefined,
        externalRef: input.externalRef ?? undefined,
        displayName: input.displayName ?? undefined,
        metadata: input.metadata as never,
        lastSeenAt: new Date(),
      },
    })
    return serialise(row)
  }

  async retrieve(merchantId: string, id: string): Promise<Customer> {
    const row = await this.prisma.db.customer.findFirst({ where: { id, merchantId } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'customer not found' })
    return serialise(row)
  }

  async list(merchantId: string, params: { limit?: number; cursor?: string | null; externalRef?: string }) {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.customer.findMany({
      where: { merchantId, externalRef: params.externalRef ?? undefined },
      orderBy: { lastSeenAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialise)
    return { data, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null, hasMore }
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function serialise(row: any): Customer {
  return {
    ...row,
    metadata: row.metadata ?? {},
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
  }
}
