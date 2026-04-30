import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import type { Transaction } from '@strimz/shared-types'
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js'
import { CurrentMerchant, type CurrentMerchantPayload } from '../../common/decorators/current-merchant.decorator.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { TransactionsService } from './transactions.service.js'

@UseGuards(ApiKeyGuard)
@RequireScopes('transactions_read')
@Controller('/v1/transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get('/:id')
  retrieve(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string): Promise<Transaction> {
    return this.transactions.retrieve(ctx.merchantId, id)
  }

  @Get()
  list(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
  ) {
    return this.transactions.list(ctx.merchantId, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ?? null,
      kind,
      status,
    })
  }
}
