import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { relayMerchantIdSchema } from './relay.dto.js'
import { RelayService } from './relay.service.js'

const bodyMerchant = new ZodValidationPipe(z.object({ merchantId: relayMerchantIdSchema }))

@Injectable()
export class RelayMerchantGuard implements CanActivate {
  constructor(private readonly relay: RelayService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>()
    if (!req.merchant) {
      throw new Error('RelayMerchantGuard must run after ApiKeyGuard')
    }
    const { merchantId } = bodyMerchant.transform(req.body, { type: 'body' })
    await this.relay.assertOwnMerchant(req.merchant.merchantId, merchantId)
    return true
  }
}
