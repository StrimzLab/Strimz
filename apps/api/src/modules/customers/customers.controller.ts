import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { evmAddressSchema, upsertCustomerInputSchema } from '@strimz/shared-types'
import type { Customer, UpsertCustomerParsed } from '@strimz/shared-types'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CustomersService } from './customers.service.js'

const listCustomersQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().max(200).optional(),
    externalRef: z.string().max(200).optional(),
    walletAddress: evmAddressSchema.optional(),
  })
  .strict()

@UseGuards(MerchantAuthGuard)
@Controller('/v1/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @RequireScopes('customers_write')
  @Post()
  upsert(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Body(new ZodValidationPipe(upsertCustomerInputSchema)) input: UpsertCustomerParsed,
  ): Promise<Customer> {
    return this.customers.upsert(ctx.merchantId, input)
  }

  @RequireScopes('customers_read')
  @Get('/:id')
  retrieve(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
  ): Promise<Customer> {
    return this.customers.retrieve(ctx.merchantId, id)
  }

  @RequireScopes('customers_read')
  @Get()
  list(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query(new ZodValidationPipe(listCustomersQuerySchema))
    q: z.infer<typeof listCustomersQuerySchema>,
  ) {
    return this.customers.list(ctx.merchantId, {
      limit: q.limit,
      cursor: q.cursor ?? null,
      externalRef: q.externalRef,
      walletAddress: q.walletAddress,
    })
  }
}
