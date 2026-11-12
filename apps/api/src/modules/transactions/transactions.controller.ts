import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import type { Transaction } from '@strimz/shared-types'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import type { z } from 'zod'
import { TransactionKind, TransactionStatus } from '@strimz/db'
import {
  dateRange,
  enumList,
  listQuerySchema,
  withDateRange,
} from '../../common/schemas/list-query.js'
import { TransactionsService } from './transactions.service.js'

const transactionListQuery = withDateRange(
  listQuerySchema.extend({
    kind: enumList(TransactionKind).optional(),
    status: enumList(TransactionStatus).optional(),
  }),
)

@UseGuards(MerchantAuthGuard)
@RequireScopes('transactions_read')
@Controller('/v1/transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get('/:id')
  retrieve(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
  ): Promise<Transaction> {
    return this.transactions.retrieve(ctx.merchantId, ctx.mode, id)
  }

  @Get()
  list(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query(new ZodValidationPipe(transactionListQuery)) q: z.infer<typeof transactionListQuery>,
  ) {
    return this.transactions.list(ctx.merchantId, ctx.mode, {
      limit: q.limit,
      cursor: q.cursor ?? null,
      kind: q.kind,
      status: q.status,
      sessionId: q.sessionId,
      subscriptionId: q.subscriptionId,
      customerId: q.customerId,
      blockTimestamp: dateRange(q),
    })
  }
}
