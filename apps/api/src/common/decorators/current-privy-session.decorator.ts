import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

export interface CurrentPrivySessionPayload {
  privyUserId: string
}

declare module 'fastify' {
  interface FastifyRequest {
    privySession?: CurrentPrivySessionPayload
  }
}

export const CurrentPrivySession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentPrivySessionPayload => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>()
    if (!req.privySession) {
      throw new Error('CurrentPrivySession decorator used on a route without PrivySessionGuard')
    }
    return req.privySession
  },
)
