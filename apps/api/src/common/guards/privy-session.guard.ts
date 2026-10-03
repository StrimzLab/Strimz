import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

import { PrivyService } from '../../infra/privy/privy.service.js'

@Injectable()
export class PrivySessionGuard implements CanActivate {
  constructor(@Inject(PrivyService) private readonly privy: PrivyService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>()
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'authentication_error',
        message: 'missing bearer token',
      })
    }
    const claims = await this.privy.verifyAccessToken(auth.slice('Bearer '.length).trim())
    req.privySession = { privyUserId: claims.userId }
    return true
  }
}
