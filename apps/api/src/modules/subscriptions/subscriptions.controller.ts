import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import type { z } from 'zod'
import { SubscriptionStatus } from '@strimz/db'
import {
  dateRange,
  enumList,
  listQuerySchema,
  withDateRange,
} from '../../common/schemas/list-query.js'
import { SubscriptionsService } from './subscriptions.service.js'
import { CancelSubscriptionDto } from './subscriptions.dto.js'

const subscriptionListQuery = withDateRange(
  listQuerySchema.extend({ status: enumList(SubscriptionStatus).optional() }),
)

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('/v1/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @RequireScopes('subscriptions_read')
  @Get('/:id')
  retrieve(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.subs.retrieve(ctx.merchantId, ctx.mode, id)
  }

  @RequireScopes('subscriptions_read')
  @Get()
  list(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query(new ZodValidationPipe(subscriptionListQuery))
    q: z.infer<typeof subscriptionListQuery>,
  ) {
    return this.subs.list(ctx.merchantId, ctx.mode, {
      limit: q.limit,
      cursor: q.cursor ?? null,
      status: q.status,
      planId: q.planId,
      customerId: q.customerId,
      createdAt: dateRange(q),
    })
  }

  @RequireScopes('subscriptions_read')
  @Get('/:id/charges')
  @ApiOperation({
    summary:
      'Every charge attempt for a subscription, newest first, including failed and skipped ones.',
  })
  charges(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
    @Query(new ZodValidationPipe(listQuerySchema)) q: z.infer<typeof listQuerySchema>,
  ) {
    return this.subs.charges(ctx.merchantId, ctx.mode, id, {
      limit: q.limit,
      cursor: q.cursor ?? null,
    })
  }

  @RequireScopes('subscriptions_write')
  @Post('/:id/cancel')
  @ApiOperation({
    summary: 'Cancel a subscription. Marks DB optimistically, enqueues on-chain cancel.',
  })
  cancel(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.subs.cancel(ctx.merchantId, ctx.mode, { ...dto, id })
  }
}
