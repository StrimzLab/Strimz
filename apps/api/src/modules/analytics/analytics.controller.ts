import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import {
  statsLtvQuerySchema,
  statsVolumeQuerySchema,
  type StatsLtvQueryParsed,
  type StatsVolumeQuery,
} from '@strimz/shared-types'
import { AnalyticsService } from './analytics.service.js'

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('/v1/stats')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @RequireScopes('analytics_read')
  @Get('/conversion')
  @ApiOperation({ summary: 'Daily checkout conversion rate.' })
  conversion(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.conversion(ctx.merchantId, ctx.mode, { from, to })
  }

  @RequireScopes('analytics_read')
  @Get('/churn')
  @ApiOperation({ summary: 'Monthly subscription churn rate.' })
  churn(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.churn(ctx.merchantId, ctx.mode, { from, to })
  }

  @RequireScopes('analytics_read')
  @Get('/mrr')
  @ApiOperation({ summary: 'Monthly recurring revenue from active subscriptions.' })
  mrr(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.analytics.mrr(ctx.merchantId, ctx.mode)
  }

  @RequireScopes('analytics_read')
  @Get('/ltv')
  @ApiOperation({ summary: 'Customer lifetime value in one currency, ranked by total spend.' })
  ltv(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query(new ZodValidationPipe(statsLtvQuerySchema)) query: StatsLtvQueryParsed,
  ) {
    return this.analytics.ltv(ctx.merchantId, ctx.mode, query)
  }

  @RequireScopes('analytics_read')
  @Get('/forecast')
  @ApiOperation({
    summary: '30/60/90-day revenue forecast (linear regression over 90-day history).',
  })
  forecast(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.analytics.forecast(ctx.merchantId, ctx.mode)
  }

  @RequireScopes('analytics_read')
  @Get('/summary')
  @ApiOperation({ summary: 'Dashboard totals per currency for the current mode.' })
  summary(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.analytics.summary(ctx.merchantId, ctx.mode)
  }

  @RequireScopes('analytics_read')
  @Get('/volume')
  @ApiOperation({ summary: 'Daily confirmed volume per currency.' })
  volume(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query(new ZodValidationPipe(statsVolumeQuerySchema)) query: StatsVolumeQuery,
  ) {
    return this.analytics.volume(ctx.merchantId, ctx.mode, query)
  }
}
