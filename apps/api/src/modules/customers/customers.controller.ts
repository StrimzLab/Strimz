import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { upsertCustomerInputSchema } from '@strimz/shared-types'
import type { Customer, UpsertCustomerInput } from '@strimz/shared-types'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { CustomersService } from './customers.service.js'

@UseGuards(MerchantAuthGuard)
@Controller('/v1/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  upsert(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Body(new ZodValidationPipe(upsertCustomerInputSchema)) input: UpsertCustomerInput,
  ): Promise<Customer> {
    return this.customers.upsert(ctx.merchantId, input)
  }

  @Get('/:id')
  retrieve(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Param('id') id: string,
  ): Promise<Customer> {
    return this.customers.retrieve(ctx.merchantId, id)
  }

  @Get()
  list(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('externalRef') externalRef?: string,
  ) {
    return this.customers.list(ctx.merchantId, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ?? null,
      externalRef,
    })
  }
}
