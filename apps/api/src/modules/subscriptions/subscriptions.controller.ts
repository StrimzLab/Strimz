import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { SubscriptionsService } from './subscriptions.service.js'
import { CancelSubscriptionDto } from './subscriptions.dto.js'

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('/v1/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @RequireScopes('subscriptions_read')
  @Get('/:id')
  retrieve(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.subs.retrieve(ctx.merchantId, id)
  }

  @RequireScopes('subscriptions_read')
  @Get()
  list(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
    @Query('planId') planId?: string,
  ) {
    return this.subs.list(ctx.merchantId, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ?? null,
      status,
      planId,
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
    return this.subs.cancel(ctx.merchantId, { ...dto, id })
  }
}
