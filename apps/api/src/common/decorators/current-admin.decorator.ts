import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import type { AdminRole } from '@strimz/db'

export interface CurrentAdminPayload {
  adminId: string
  email: string
  role: AdminRole
}

declare module 'fastify' {
  interface FastifyRequest {
    admin?: CurrentAdminPayload
  }
}

/**
 * Inject the resolved admin context into a controller method. Mirror
 * of `@CurrentMerchant`, but for `/v1/admin/*` handlers.
 */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentAdminPayload => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>()
    if (!req.admin) {
      throw new Error('CurrentAdmin decorator used on an unauthenticated route')
    }
    return req.admin
  },
)
