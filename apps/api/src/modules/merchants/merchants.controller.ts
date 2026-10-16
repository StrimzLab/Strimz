import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import { SessionOnly } from '../../common/decorators/session-only.decorator.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { MerchantsService } from './merchants.service.js'
import { MerchantChainService } from './merchant-chain.service.js'
import { OnboardDto, UpdateMerchantDto } from './merchants.dto.js'

@ApiTags('merchants')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('/v1/merchants')
export class MerchantsController {
  constructor(
    private readonly merchants: MerchantsService,
    private readonly merchantChain: MerchantChainService,
  ) {}

  @RequireScopes('merchants_read')
  @Get('/me')
  @ApiOperation({ summary: 'Read the current merchant profile.' })
  me(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.merchants.findById(ctx.merchantId)
  }

  @SessionOnly()
  @Patch('/me')
  @ApiOperation({ summary: 'Update merchant profile fields.' })
  update(@CurrentMerchant() ctx: CurrentMerchantPayload, @Body() dto: UpdateMerchantDto) {
    return this.merchants.update(ctx.merchantId, dto)
  }

  @SessionOnly()
  @Post('/me/onboard')
  @ApiOperation({
    summary:
      'Submit the self-attested business onboarding form (business name, sector, country, payout address).',
  })
  onboard(@CurrentMerchant() ctx: CurrentMerchantPayload, @Body() dto: OnboardDto) {
    return this.merchants.onboard(ctx.merchantId, dto)
  }

  @RequireScopes('merchants_read')
  @Get('/me/live-mode-eligibility')
  @ApiOperation({
    summary:
      'Return whether the merchant can issue live API keys, plus structured reasons for any gating.',
  })
  liveModeEligibility(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.merchants.liveModeEligibility(ctx.merchantId)
  }

  @RequireScopes('merchants_read')
  @Get('/me/chain-status')
  @ApiOperation({
    summary:
      "Read the merchant's on-chain registry id (if any) and the prerequisites still needed to register.",
  })
  async chainStatus(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    const s = await this.merchantChain.getStatus(ctx.merchantId)
    return {
      // bigint isn't JSON-serialisable; keep parity with the rest of the
      // wire format and stringify.
      onchainMerchantId: s.onchainMerchantId !== null ? s.onchainMerchantId.toString() : null,
      walletAddress: s.walletAddress,
      payoutAddress: s.payoutAddress,
      eligible: s.eligible,
      missing: s.missing,
    }
  }

  @RequireScopes('merchants_read')
  @Get('/me/onchain-state')
  @ApiOperation({
    summary:
      "Live on-chain merchant record from the Registry. Backs the Settings page's payout-rotation and ownership-transfer flows.",
  })
  onchainState(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.merchantChain.getOnchainState(ctx.merchantId)
  }

  @RequireScopes('merchants_read')
  @Get('/me/balance')
  @ApiOperation({
    summary:
      'Live on-chain USDC + EURC balance at the merchant`s payout address. Backs the /app/withdraw page.',
  })
  balance(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.merchants.getBalance(ctx.merchantId)
  }
}
