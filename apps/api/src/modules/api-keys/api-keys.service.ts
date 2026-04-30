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

  async list(merchantId: string): Promise<ApiKey[]> {
    const rows = await this.prisma.db.merchantApiKey.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(serialise)
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
