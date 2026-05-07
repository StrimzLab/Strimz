import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'
import { hashApiKey } from '@strimz/shared-crypto'
import { kindFromKey, modeFromKey } from '@strimz/shared-config'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'
import { REQUIRED_SCOPES_KEY } from '../decorators/scopes.decorator.js'
import type { ApiKeyScope } from '@strimz/shared-types'

/**
 * Authenticates SDK callers via secret API key.
 *
 *   Authorization: Bearer sk_test_xxx
 *
 * Resolves the calling merchant, attaches it to `req.merchant`, and enforces
 * any scope metadata declared via `@RequireScopes(...)`.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
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
      throw new UnauthorizedException({ code: 'authentication_error', message: 'invalid api key' })
    }
    if (apiKey.merchant.status !== 'active') {
      throw new ForbiddenException({ code: 'permission_denied', message: 'merchant suspended' })
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

    // Best-effort lastUsedAt update; don't block the request.
    void this.prisma.db.merchantApiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined)

    return true
  }
}
