import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { listQuerySchema, type ListQuery } from '../../common/schemas/list-query.js'
import { RefundsService } from './refunds.service.js'
import { CreateRefundDto, SubmitRefundSignatureDto } from './refunds.dto.js'

@ApiTags('refunds')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('/v1/refunds')
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @RequireScopes('refunds_write')
  @Post()
  @ApiOperation({
    summary:
      'Create a refund intent. Returns wallet-signing instructions for the merchant to broadcast on-chain.',
  })
  create(@CurrentMerchant() ctx: CurrentMerchantPayload, @Body() dto: CreateRefundDto) {
    // The merchant API key is the actor for now; later this will be
    // the dashboard user's id.
    return this.refunds.create(ctx.merchantId, ctx.mode, ctx.apiKeyId ?? ctx.merchantId, dto)
  }

  @RequireScopes('refunds_read')
  @Get('/:id')
  retrieve(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.refunds.retrieve(ctx.merchantId, ctx.mode, id)
  }

  @RequireScopes('refunds_read')
  @Get()
  list(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query(new ZodValidationPipe(listQuerySchema)) q: ListQuery,
  ) {
    return this.refunds.list(ctx.merchantId, ctx.mode, {
      limit: q.limit,
      cursor: q.cursor ?? null,
      status: q.status,
    })
  }

  @RequireScopes('refunds_write')
  @Post('/:id/signature')
  @ApiOperation({ summary: 'Record the on-chain tx hash after signing the refund transfer.' })
  submitSignature(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
    @Body() dto: SubmitRefundSignatureDto,
  ) {
    return this.refunds.submitSignature(ctx.merchantId, ctx.mode, { ...dto, id })
  }
}
