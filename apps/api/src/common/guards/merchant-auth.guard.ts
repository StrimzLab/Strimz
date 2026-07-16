import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'
import { hashApiKey } from '@strimz/shared-crypto'
import { kindFromKey, modeFromKey } from '@strimz/shared-config'
import type { ApiKeyScope } from '@strimz/shared-types'

import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { PrivyService } from '../../infra/privy/privy.service.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'
import { REQUIRED_SCOPES_KEY } from '../decorators/scopes.decorator.js'

/**
 * Unified merchant auth guard.
 *
 * Accepts either:
 *   - `Authorization: Bearer sk_test_…` / `sk_live_…` — merchant API key
 *     (same semantics as the original ApiKeyGuard). The integration path.
 *   - `Authorization: Bearer <privy-access-token>` — Privy access token
 *     (same semantics as the original PrivyAuthGuard). The dashboard path.
 *
 * The dispatch keys off the token prefix:
 *   - Anything that begins `sk_` or `pk_` goes through the API key flow.
 *   - Anything else is treated as a Privy access token.
 *
 * Why a single guard rather than stacking both with allowEither logic:
 *   - The API key flow needs scope enforcement against `@RequireScopes`.
 *     The Privy flow doesn't (the dashboard's role gating happens at
 *     a higher layer). One guard knows when to skip scope checks.
 *   - The two flows have different failure messages — "invalid api key"
 *     vs "missing bearer token" — that we'd otherwise have to plumb
 *     through a chained-guard hack.
 *
 * Use this on every controller the dashboard reads. Existing
 * integration-only controllers can keep `ApiKeyGuard`; existing
 * dashboard-only controllers can keep `PrivyAuthGuard`. The point of
 * this guard is the resources where BOTH callers need to land.
 */
@Injectable()
export class MerchantAuthGuard implements CanActivate {
  private readonly log = new Logger(MerchantAuthGuard.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    @Inject(PrivyService) private readonly privy: PrivyService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (isPublic) return true

    const req = ctx.switchToHttp().getRequest<FastifyRequest>()
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'authentication_error',
        message: 'missing bearer token',
      })
    }
    const token = auth.slice('Bearer '.length).trim()

    const isStrimzKey = token.startsWith('sk_') || token.startsWith('pk_')
    if (isStrimzKey) {
      await this.authenticateWithApiKey(token, ctx, req)
    } else {
      await this.authenticateWithPrivy(token, req)
    }
    return true
  }

  // ------------------------------------------------------------------
  // Path 1 — Merchant API key (sk_… or pk_…)
  // ------------------------------------------------------------------
  private async authenticateWithApiKey(
    token: string,
    ctx: ExecutionContext,
    req: FastifyRequest,
  ): Promise<void> {
    if (kindFromKey(token) !== 'secret') {
      throw new UnauthorizedException({
        code: 'authentication_error',
        message: 'invalid api key kind',
      })
    }
    const mode = modeFromKey(token)
    if (mode == null) {
      throw new UnauthorizedException({
        code: 'authentication_error',
        message: 'invalid api key prefix',
      })
    }

    const hash = await hashApiKey(token)
    const apiKey = await this.prisma.db.merchantApiKey.findUnique({
      where: { hash },
      include: { merchant: true },
    })
    if (!apiKey || apiKey.revokedAt != null) {
      throw new UnauthorizedException({
        code: 'authentication_error',
        message: 'invalid api key',
      })
    }
    if (apiKey.merchant.status !== 'active') {
      throw new ForbiddenException({
        code: 'permission_denied',
        message: 'merchant suspended',
      })
    }

    const required =
      this.reflector.getAllAndOverride<ApiKeyScope[]>(REQUIRED_SCOPES_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? []
    if (required.length > 0) {
      const has = new Set(apiKey.scopes as unknown as string[])
      for (const s of required) {
        if (!has.has(s)) {
          throw new ForbiddenException({
            code: 'permission_denied',
            message: `api key missing scope ${s}`,
          })
        }
      }
    }

    req.merchant = {
      merchantId: apiKey.merchantId,
      apiKeyId: apiKey.id,
      mode: apiKey.mode as 'test' | 'live',
    }

    void this.prisma.db.merchantApiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined)
  }

  // ------------------------------------------------------------------
  // Path 2 — Privy access token (dashboard)
  // ------------------------------------------------------------------
  private async authenticateWithPrivy(token: string, req: FastifyRequest): Promise<void> {
    const claims = await this.privy.verifyAccessToken(token)

    const merchant = await this.prisma.db.merchant.findUnique({
      where: { privyUserId: claims.userId },
      select: { id: true, status: true },
    })
    if (!merchant) {
      throw new UnauthorizedException({
        code: 'merchant_not_synced',
        message: 'first-time login — POST /v1/auth/sync to create your merchant record',
      })
    }
    if (merchant.status !== 'active') {
      throw new ForbiddenException({
        code: 'permission_denied',
        message: `merchant account is ${merchant.status}`,
      })
    }

    // Dashboard traffic ships an `x-strimz-mode` header carrying the
    // merchant's current toggle selection. Missing / malformed values
    // fall back to test — the safer default that runs on Arc testnet.
    const headerMode = String(req.headers['x-strimz-mode'] ?? '').toLowerCase()
    const mode: 'test' | 'live' = headerMode === 'live' ? 'live' : 'test'

    req.merchant = {
      merchantId: merchant.id,
      mode,
    }

    void this.prisma.db.merchant
      .update({ where: { id: merchant.id }, data: { lastLoginAt: new Date() } })
      .catch((err: unknown) =>
        this.log.warn(`failed to update lastLoginAt: ${(err as Error).message}`),
      )
  }
}
