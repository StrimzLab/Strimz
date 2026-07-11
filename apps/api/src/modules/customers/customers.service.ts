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

  async upsertFromCheckout(input: {
    merchantId: string
    walletAddress: string
    email: string
  }): Promise<Customer> {
    // Lowercase to match the indexer's Customer upsert; a checksummed
    // wallet here would create a second, email-less row from chain events.
    const walletAddress = input.walletAddress.toLowerCase()
    const now = new Date()
    const existing = await this.prisma.db.customer.findUnique({
      where: {
        merchantId_walletAddress: {
          merchantId: input.merchantId,
          walletAddress,
        },
      },
    })

    if (!existing) {
      const created = await this.prisma.db.customer.create({
        data: {
          merchantId: input.merchantId,
          walletAddress,
          email: input.email,
          metadata: {
            emailHistory: [{ email: input.email, seenAt: now.toISOString() }],
          } as never,
        },
      })
      return serialise(created)
    }

    const priorHistory = readEmailHistory(existing.metadata)
    const emailChanged = existing.email !== input.email
    const nextHistory =
      emailChanged || priorHistory.length === 0
        ? [...priorHistory, { email: input.email, seenAt: now.toISOString() }]
        : priorHistory
    const nextMetadata = { ...toRecord(existing.metadata), emailHistory: nextHistory }

    const updated = await this.prisma.db.customer.update({
      where: { id: existing.id },
      data: {
        email: input.email,
        metadata: nextMetadata as never,
        lastSeenAt: now,
      },
    })
    return serialise(updated)
  }

  async list(
    merchantId: string,
    params: { limit?: number; cursor?: string | null; externalRef?: string },
  ) {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.customer.findMany({
      where: { merchantId, externalRef: params.externalRef ?? undefined },
      orderBy: { lastSeenAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialise)
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
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

interface EmailHistoryEntry {
  email: string
  seenAt: string
}

function toRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === 'object'
    ? { ...(metadata as Record<string, unknown>) }
    : {}
}

function readEmailHistory(metadata: unknown): EmailHistoryEntry[] {
  const bag = toRecord(metadata)
  const raw = bag.emailHistory
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (entry): entry is EmailHistoryEntry =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as EmailHistoryEntry).email === 'string' &&
      typeof (entry as EmailHistoryEntry).seenAt === 'string',
  )
}
