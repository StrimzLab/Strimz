import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'
import { PrivyService } from '../../infra/privy/privy.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'

/**
 * Authenticates dashboard users via Privy access tokens.
 *
 *   Authorization: Bearer <privy access token>
 *
 * On success the request gets:
 *   req.merchant = { merchantId, mode }
 *
 * Side-effect: updates `Merchant.lastLoginAt` opportunistically (best effort,
 * never blocks the request). Merchants that don't yet exist must call
 * `POST /v1/auth/sync` first — that endpoint is the only one that can create
 * a Merchant row; everything else assumes the row exists.
 */
@Injectable()
export class PrivyAuthGuard implements CanActivate {
  private readonly log = new Logger(PrivyAuthGuard.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly privy: PrivyService,
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
    const claims = await this.privy.verifyAccessToken(token)

    const merchant = await this.prisma.db.merchant.findUnique({
      where: { privyUserId: claims.userId },
      select: { id: true, status: true },
    })
    if (!merchant) {
      // The Privy token is valid but the merchant has never called /auth/sync.
      // Surface a specific code so the dashboard knows to redirect to onboarding.
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

    req.merchant = {
      merchantId: merchant.id,
      // Mode is determined per-resource for dashboard calls; default to test.
      mode: 'test',
    }

    void this.prisma.db.merchant
      .update({ where: { id: merchant.id }, data: { lastLoginAt: new Date() } })
      .catch((err: unknown) =>
        this.log.warn(`failed to update lastLoginAt: ${(err as Error).message}`),
      )

    return true
  }
}
