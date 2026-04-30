import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js'
import { CurrentMerchant, type CurrentMerchantPayload } from '../../common/decorators/current-merchant.decorator.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { InvoicesService } from './invoices.service.js'
import { CreateInvoiceDto } from './invoices.dto.js'

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
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
    return this.invoices.retrieve(ctx.merchantId, id)
  }

  @RequireScopes('invoices_read')
  @Get()
  list(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
  ) {
    return this.invoices.list(ctx.merchantId, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ?? null,
      status,
    })
  }

  @RequireScopes('invoices_write')
  @Post('/:id/send')
  @ApiOperation({ summary: 'Send the invoice via email to the customer email recorded on it.' })
  send(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.invoices.send(ctx.merchantId, id)
  }

  @RequireScopes('invoices_write')
  @Post('/:id/void')
  void(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.invoices.voidInvoice(ctx.merchantId, id)
  }
}
