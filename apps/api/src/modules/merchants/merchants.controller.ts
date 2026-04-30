import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { PrivyAuthGuard } from '../../common/guards/privy.guard.js'
import { CurrentMerchant, type CurrentMerchantPayload } from '../../common/decorators/current-merchant.decorator.js'
import { MerchantsService } from './merchants.service.js'
import { ChangeTierDto, OnboardDto, UpdateMerchantDto } from './merchants.dto.js'

@ApiTags('merchants')
@ApiBearerAuth()
@UseGuards(PrivyAuthGuard)
@Controller('/v1/merchants')
export class MerchantsController {
  constructor(private readonly merchants: MerchantsService) {}

  @Get('/me')
  @ApiOperation({ summary: 'Read the current merchant profile.' })
  me(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.merchants.findById(ctx.merchantId)
  }

  @Patch('/me')
  @ApiOperation({ summary: 'Update merchant profile fields.' })
  update(@CurrentMerchant() ctx: CurrentMerchantPayload, @Body() dto: UpdateMerchantDto) {
    return this.merchants.update(ctx.merchantId, dto)
  }

  @Post('/me/onboard')
  @ApiOperation({
    summary:
      'Submit the self-attested business onboarding form (business name, sector, country, payout address).',
  })
  onboard(@CurrentMerchant() ctx: CurrentMerchantPayload, @Body() dto: OnboardDto) {
    return this.merchants.onboard(ctx.merchantId, dto)
  }

  @Post('/me/tier')
  @ApiOperation({ summary: 'Change merchant pricing tier.' })
  changeTier(@CurrentMerchant() ctx: CurrentMerchantPayload, @Body() dto: ChangeTierDto) {
    return this.merchants.changeTier(ctx.merchantId, dto)
  }

  @Get('/me/live-mode-eligibility')
  @ApiOperation({
    summary:
      'Return whether the merchant can issue live API keys, plus structured reasons for any gating.',
  })
  liveModeEligibility(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.merchants.liveModeEligibility(ctx.merchantId)
  }
}
