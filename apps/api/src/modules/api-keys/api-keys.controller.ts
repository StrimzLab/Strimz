import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { createApiKeyInputSchema } from '@strimz/shared-types'
import type { ApiKey, CreateApiKeyInput, CreateApiKeyOutput } from '@strimz/shared-types'
import { JwtGuard } from '../../common/guards/jwt.guard.js'
import { CurrentMerchant, type CurrentMerchantPayload } from '../../common/decorators/current-merchant.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { ApiKeysService } from './api-keys.service.js'

@UseGuards(JwtGuard)
@Controller('/v1/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Post()
  create(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Body(new ZodValidationPipe(createApiKeyInputSchema)) input: CreateApiKeyInput,
  ): Promise<CreateApiKeyOutput> {
    return this.apiKeys.create(ctx.merchantId, input)
  }

  @Get()
  list(@CurrentMerchant() ctx: CurrentMerchantPayload): Promise<ApiKey[]> {
    return this.apiKeys.list(ctx.merchantId)
  }

  @Get('/:id')
  retrieve(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
  ): Promise<ApiKey> {
    return this.apiKeys.retrieve(ctx.merchantId, id)
  }

  @Post('/:id/revoke')
  revoke(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
  ): Promise<ApiKey> {
    return this.apiKeys.revoke(ctx.merchantId, id)
  }
}
