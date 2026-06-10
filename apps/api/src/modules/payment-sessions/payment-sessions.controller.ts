import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { createPaymentSessionInputSchema } from '@strimz/shared-types'
import type { CreatePaymentSessionInput, PaymentSession } from '@strimz/shared-types'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { PaymentSessionsService } from './payment-sessions.service.js'

@UseGuards(MerchantAuthGuard)
@Controller('/v1/payment-sessions')
export class PaymentSessionsController {
  constructor(private readonly sessions: PaymentSessionsService) {}

  @RequireScopes('sessions_write')
  @Post()
  create(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Body(new ZodValidationPipe(createPaymentSessionInputSchema)) input: CreatePaymentSessionInput,
  ): Promise<PaymentSession> {
    return this.sessions.create(ctx.merchantId, ctx.mode, input)
  }

  @RequireScopes('sessions_read')
  @Get('/:id')
  retrieve(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
  ): Promise<PaymentSession> {
    return this.sessions.retrieve(ctx.merchantId, id)
  }

  @RequireScopes('sessions_read')
  @Get()
  list(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
  ) {
    return this.sessions.list(ctx.merchantId, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ?? null,
      status,
    })
  }

  @RequireScopes('sessions_write')
  @Post('/:id/cancel')
  cancel(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
  ): Promise<PaymentSession> {
    return this.sessions.cancel(ctx.merchantId, id)
  }

  @RequireScopes('sessions_write')
  @Post('/:id/expire')
  expire(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
  ): Promise<PaymentSession> {
    return this.sessions.expire(ctx.merchantId, id)
  }
}
