import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { createApiKeyInputSchema } from '@strimz/shared-types'
import type { ApiKey, CreateApiKeyInput, CreateApiKeyOutput } from '@strimz/shared-types'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { listQuerySchema, type ListQuery } from '../../common/schemas/list-query.js'
import { ApiKeysService } from './api-keys.service.js'

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('/v1/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @RequireScopes('api_keys_write')
  @Post()
  create(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Body(new ZodValidationPipe(createApiKeyInputSchema)) input: CreateApiKeyInput,
  ): Promise<CreateApiKeyOutput> {
    return this.apiKeys.create(ctx.merchantId, input)
  }

  @RequireScopes('api_keys_read')
  @Get()
  list(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query(new ZodValidationPipe(listQuerySchema)) q: ListQuery,
  ) {
    return this.apiKeys.list(ctx.merchantId, {
      limit: q.limit,
      cursor: q.cursor ?? null,
      revoked: q.revoked === 'true' ? true : q.revoked === 'false' ? false : undefined,
    })
  }

  @RequireScopes('api_keys_read')
  @Get('/:id')
  retrieve(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
  ): Promise<ApiKey> {
    return this.apiKeys.retrieve(ctx.merchantId, id)
  }

  @RequireScopes('api_keys_write')
  @Post('/:id/revoke')
  revoke(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string): Promise<ApiKey> {
    return this.apiKeys.revoke(ctx.merchantId, id)
  }

  @RequireScopes('api_keys_write')
  @Post('/:id/rotate')
  @ApiOperation({ summary: 'Revoke this key and mint a fresh one with identical scopes.' })
  rotate(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
  ): Promise<CreateApiKeyOutput> {
    return this.apiKeys.rotate(ctx.merchantId, id)
  }
}
