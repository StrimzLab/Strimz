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
import type { AdminRole } from '@strimz/db'

import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { PrivyService } from '../../infra/privy/privy.service.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'
import { REQUIRED_ADMIN_ROLES_KEY } from '../decorators/admin-role.decorator.js'

/**
 * Authenticates Strimz operators against `AdminUser`.
 *
 * The bearer token is a Privy access token, same shape as the
 * merchant dashboard's auth. The difference is the lookup: we resolve
 * the caller to an `AdminUser` row, not a `Merchant`. A given Privy
 * user can be both (we eat our own dog food), and the two surfaces
 * stay isolated.
 *
 * Bootstrap path:
 *   The first super_admin row is seeded by migration with `privyUserId`
 *   set to NULL and just an `email`. When that operator signs in for
 *   the first time, the guard:
 *     1. Looks up by `privyUserId`. Not found (NULL).
 *     2. Falls back to `email` from the verified Privy claims.
 *     3. Stamps `privyUserId` on the matching row.
 *   From then on, lookup-by-privyUserId hits the cache hot path.
 *
 * Role enforcement:
 *   `@RequireAdminRoles('super_admin')` on a handler narrows to that
 *   role list. Without the decorator, any active AdminUser passes.
 *   Suspended admins are rejected unconditionally.
 *
 * Why a fresh guard rather than reusing MerchantAuthGuard's logic:
 *   - The lookup surface is different (AdminUser, not Merchant).
 *   - Role gating is decorator-driven; merchant scopes are
 *     ApiKey-bound and only checked on API-key-auth paths.
 *   - The bootstrap email-claim flow is admin-specific.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly log = new Logger(AdminAuthGuard.name)

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

    const claims = await this.privy.verifyAccessToken(token)

    // Path 1 — already-linked admin.
    let admin = await this.prisma.db.adminUser.findUnique({
      where: { privyUserId: claims.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    })

    // Path 2 — bootstrap. The Privy access-token claims don't include
    // a verified email; we fetch the full Privy user to read the
    // linked email address. If a matching row exists with
    // `privyUserId IS NULL`, claim it.
    if (!admin) {
      let email: string | null = null
      try {
        const user = await this.privy.getUser(claims.userId)
        const linkedEmail = user.linkedAccounts.find((a) => a.type === 'email')
        if (linkedEmail && 'address' in linkedEmail && typeof linkedEmail.address === 'string') {
          email = linkedEmail.address.toLowerCase()
        }
      } catch (err: unknown) {
        // If Privy is unreachable, we can't bootstrap. Surface a clear
        // failure rather than silently denying.
        this.log.warn(`admin bootstrap: failed to fetch privy user — ${(err as Error).message}`)
      }

      if (email) {
        const candidate = await this.prisma.db.adminUser.findUnique({
          where: { email },
          select: { id: true, email: true, role: true, status: true, privyUserId: true },
        })
        if (candidate && candidate.privyUserId == null) {
          this.log.log(
            `admin bootstrap: claiming row ${candidate.id} for privy user ${claims.userId}`,
          )
          admin = await this.prisma.db.adminUser.update({
            where: { id: candidate.id },
            data: { privyUserId: claims.userId, lastLoginAt: new Date() },
            select: { id: true, email: true, role: true, status: true },
          })
        }
      }
    }

    if (!admin) {
      throw new ForbiddenException({
        code: 'admin_access_denied',
        message: 'no admin profile for this account',
      })
    }
    if (admin.status !== 'active') {
      throw new ForbiddenException({
        code: 'admin_account_inactive',
        message: `admin account is ${admin.status}`,
      })
    }

    const required = this.reflector.getAllAndOverride<AdminRole[]>(REQUIRED_ADMIN_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (required && required.length > 0 && !required.includes(admin.role)) {
      throw new ForbiddenException({
        code: 'admin_insufficient_role',
        message: `requires role ${required.join(' or ')}; you have ${admin.role}`,
      })
    }

    req.admin = {
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
    }

    // Best-effort lastLoginAt update; don't block the request.
    void this.prisma.db.adminUser
      .update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } })
      .catch((err: unknown) =>
        this.log.warn(`admin lastLoginAt update failed: ${(err as Error).message}`),
      )

    return true
  }
}
