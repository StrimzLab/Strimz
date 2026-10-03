import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { generateApiKey } from '@strimz/shared-crypto'
import type {
  ApiKeyScope,
  CreateApiKeyParsed,
  CreateApiKeyOutput,
  ApiKey,
  Mode,
} from '@strimz/shared-types'
import type { CurrentMerchantPayload } from '../../common/decorators/current-merchant.decorator.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { MerchantsService } from '../merchants/merchants.service.js'

export type ApiKeyCaller = Pick<CurrentMerchantPayload, 'merchantId' | 'mode' | 'apiKeyScopes'>

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly merchants: MerchantsService,
    private readonly chain: ChainService,
  ) {}

  async create(caller: ApiKeyCaller, input: CreateApiKeyParsed): Promise<CreateApiKeyOutput> {
    const merchantId = caller.merchantId
    if (caller.apiKeyScopes) {
      if (input.mode !== caller.mode) {
        throw new ForbiddenException({
          code: 'permission_denied',
          message: `a ${caller.mode} api key cannot create a ${input.mode} api key`,
        })
      }
      assertScopesHeld(caller.apiKeyScopes, input.scopes)
    }
    if (input.mode === 'live') await this.assertLiveKeyMintable(merchantId)
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
    caller: ApiKeyCaller,
    params: { limit?: number; cursor?: string | null; revoked?: boolean } = {},
  ): Promise<{ data: ApiKey[]; nextCursor: string | null; hasMore: boolean }> {
    const limit = Math.min(params.limit ?? 25, 100)
    const where: Record<string, unknown> = visibleTo(caller)
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

  async retrieve(caller: ApiKeyCaller, id: string): Promise<ApiKey> {
    const row = await this.prisma.db.merchantApiKey.findFirst({
      where: { id, ...visibleTo(caller) },
    })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'api key not found' })
    return serialise(row)
  }

  async revoke(caller: ApiKeyCaller, id: string): Promise<ApiKey> {
    const row = await this.prisma.db.merchantApiKey.findFirst({
      where: { id, ...visibleTo(caller) },
    })
    if (!row) throw new NotFoundException({ code: 'not_found', message: 'api key not found' })
    const updated = await this.prisma.db.merchantApiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
    return serialise(updated)
  }

  async rotate(caller: ApiKeyCaller, id: string): Promise<CreateApiKeyOutput> {
    const merchantId = caller.merchantId
    const source = await this.prisma.db.merchantApiKey.findFirst({
      where: { id, ...visibleTo(caller) },
    })
    if (!source) throw new NotFoundException({ code: 'not_found', message: 'api key not found' })
    if (caller.apiKeyScopes) assertScopesHeld(caller.apiKeyScopes, source.scopes)
    if (source.mode === 'live') await this.assertLiveKeyMintable(merchantId)
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

  private async assertLiveKeyMintable(merchantId: string): Promise<void> {
    if (this.chain.environment !== 'mainnet') {
      throw new ForbiddenException({
        code: 'live_mode_unavailable',
        message: 'live mode is not available until Arc mainnet is configured',
      })
    }
    const eligibility = await this.merchants.liveModeEligibility(merchantId)
    if (!eligibility.eligible) {
      throw new ForbiddenException({
        code: 'live_mode_ineligible',
        message: 'merchant is not eligible for live mode',
        details: { reasons: eligibility.reasons },
      })
    }
  }
}

function visibleTo(caller: ApiKeyCaller): { merchantId: string; mode?: Mode } {
  return caller.apiKeyScopes
    ? { merchantId: caller.merchantId, mode: caller.mode }
    : { merchantId: caller.merchantId }
}

function assertScopesHeld(held: readonly ApiKeyScope[], requested: readonly ApiKeyScope[]): void {
  const heldSet = new Set(held)
  for (const scope of requested) {
    if (!heldSet.has(scope)) {
      throw new ForbiddenException({
        code: 'permission_denied',
        message: `api key cannot grant scope ${scope} it does not hold`,
      })
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
