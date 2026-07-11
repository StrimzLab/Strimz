import { Injectable, NotFoundException } from '@nestjs/common'
import { generateApiKey } from '@strimz/shared-crypto'
import type { CreateApiKeyInput, CreateApiKeyOutput, ApiKey } from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(merchantId: string, input: CreateApiKeyInput): Promise<CreateApiKeyOutput> {
    const generated = await generateApiKey(input.kind, input.mode)
    const row = await this.prisma.db.merchantApiKey.create({
      data: {
        merchantId,
        name: input.name,
        kind: input.kind,
        mode: input.mode,
        hash: generated.hash,
        prefix: generated.prefix,
        lastFour: generated.lastFour,
        scopes: input.scopes as never,
      },
    })
    return {
      apiKey: serialise(row),
      secret: generated.secret,
    }
  }

  async list(
    merchantId: string,
    params: { limit?: number; cursor?: string | null; revoked?: boolean } = {},
  ): Promise<{ data: ApiKey[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = Math.min(params.limit ?? 25, 100)
    const where: Record<string, unknown> = { merchantId }
    if (params.revoked === true) where.revokedAt = { not: null }
    if (params.revoked === false) where.revokedAt = null
    const rows = await this.prisma.db.merchantApiKey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialise)
    return {
      data,
      nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
      hasMore,
    }
  }

  async retrieve(merchantId: string, id: string): Promise<ApiKey> {
    const row = await this.prisma.db.merchantApiKey.findFirst({ where: { id, merchantId } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'api key not found' })
    return serialise(row)
  }

  async revoke(merchantId: string, id: string): Promise<ApiKey> {
    const row = await this.prisma.db.merchantApiKey.findFirst({ where: { id, merchantId } })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'api key not found' })
    const updated = await this.prisma.db.merchantApiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
    return serialise(updated)
  }

  async rotate(merchantId: string, id: string): Promise<CreateApiKeyOutput> {
    const source = await this.prisma.db.merchantApiKey.findFirst({ where: { id, merchantId } })
    if (!source) throw new NotFoundException({ code: 'not_found', message: 'api key not found' })
    const generated = await generateApiKey(source.kind, source.mode)
    const [, newRow] = await this.prisma.db.$transaction([
      this.prisma.db.merchantApiKey.update({
        where: { id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.db.merchantApiKey.create({
        data: {
          merchantId,
          name: source.name,
          kind: source.kind,
          mode: source.mode,
          hash: generated.hash,
          prefix: generated.prefix,
          lastFour: generated.lastFour,
          scopes: source.scopes as never,
        },
      }),
    ])
    return {
      apiKey: serialise(newRow),
      secret: generated.secret,
    }
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function serialise(row: any): ApiKey {
  return {
    id: row.id,
    merchantId: row.merchantId,
    name: row.name,
    kind: row.kind,
    mode: row.mode,
    prefix: row.prefix,
    lastFour: row.lastFour,
    scopes: row.scopes,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }
}
