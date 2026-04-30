import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

export interface CurrentMerchantPayload {
  merchantId: string
  /** Present when authenticated by JWT. */
  memberId?: string
  /** Present when authenticated by API key. */
  apiKeyId?: string
  mode: 'test' | 'live'
}

declare module 'fastify' {
  interface FastifyRequest {
    merchant?: CurrentMerchantPayload
  }
}

/**
 * Inject the resolved merchant context into a controller method.
 *
 *   @Get('/v1/merchants/me')
 *   me(@CurrentMerchant() m: CurrentMerchantPayload) { ... }
 */
export const CurrentMerchant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentMerchantPayload => {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>()
    if (!req.merchant) {
      throw new Error('CurrentMerchant decorator used on an unauthenticated route')
    }
    return req.merchant
  },
)
