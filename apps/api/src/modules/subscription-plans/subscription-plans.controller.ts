import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { createSubscriptionPlanInputSchema } from '@strimz/shared-types'
import type { CreateSubscriptionPlanInput, SubscriptionPlan } from '@strimz/shared-types'
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { SubscriptionPlansService } from './subscription-plans.service.js'

@UseGuards(ApiKeyGuard)
@Controller('/v1/subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly plans: SubscriptionPlansService) {}

  @RequireScopes('subscriptions_write')
  @Post()
  create(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Body(new ZodValidationPipe(createSubscriptionPlanInputSchema))
    input: CreateSubscriptionPlanInput,
  ): Promise<SubscriptionPlan> {
    return this.plans.create(ctx.merchantId, ctx.mode, input)
  }

  @RequireScopes('subscriptions_read')
  @Get('/:id')
  retrieve(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
  ): Promise<SubscriptionPlan> {
    return this.plans.retrieve(ctx.merchantId, id)
  }

  @RequireScopes('subscriptions_read')
  @Get()
  list(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
  ) {
    return this.plans.list(ctx.merchantId, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ?? null,
      status,
    })
  }

  @RequireScopes('subscriptions_write')
  @Post('/:id/archive')
  archive(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
  ): Promise<SubscriptionPlan> {
    return this.plans.archive(ctx.merchantId, id)
  }
}
