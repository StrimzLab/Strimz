import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { AnalyticsService } from './analytics.service.js'

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('/v1/stats')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('/conversion')
  @ApiOperation({ summary: 'Daily checkout conversion rate.' })
  conversion(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.conversion(ctx.merchantId, ctx.mode, { from, to })
  }

  @Get('/churn')
  @ApiOperation({ summary: 'Monthly subscription churn rate.' })
  churn(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.churn(ctx.merchantId, ctx.mode, { from, to })
  }

  @Get('/mrr')
  @ApiOperation({ summary: 'Monthly recurring revenue from active subscriptions.' })
  mrr(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.analytics.mrr(ctx.merchantId, ctx.mode)
  }

  @Get('/ltv')
  @ApiOperation({ summary: 'Customer lifetime value, ranked by total spend.' })
  ltv(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.analytics.ltv(ctx.merchantId, ctx.mode, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ?? null,
    })
  }

  @Get('/forecast')
  @ApiOperation({
    summary: '30/60/90-day revenue forecast (linear regression over 90-day history).',
  })
  forecast(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.analytics.forecast(ctx.merchantId, ctx.mode)
  }
}
