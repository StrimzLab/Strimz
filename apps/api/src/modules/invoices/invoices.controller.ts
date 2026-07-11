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
import { InvoicesService } from './invoices.service.js'
import { CreateInvoiceDto } from './invoices.dto.js'

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('/v1/invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @RequireScopes('invoices_write')
  @Post()
  @ApiOperation({ summary: 'Create an invoice and a backing payment session.' })
  create(@CurrentMerchant() ctx: CurrentMerchantPayload, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(ctx.merchantId, ctx.mode, dto)
  }

  @RequireScopes('invoices_read')
  @Get('/:id')
  retrieve(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.invoices.retrieve(ctx.merchantId, ctx.mode, id)
  }

  @RequireScopes('invoices_read')
  @Get()
  list(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query(new ZodValidationPipe(listQuerySchema)) q: ListQuery,
  ) {
    return this.invoices.list(ctx.merchantId, ctx.mode, {
      limit: q.limit,
      cursor: q.cursor ?? null,
      status: q.status,
    })
  }

  @RequireScopes('invoices_write')
  @Post('/:id/send')
  @ApiOperation({ summary: 'Send the invoice via email to the customer email recorded on it.' })
  send(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.invoices.send(ctx.merchantId, ctx.mode, id)
  }

  @RequireScopes('invoices_write')
  @Post('/:id/void')
  void(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.invoices.voidInvoice(ctx.merchantId, ctx.mode, id)
  }
}
