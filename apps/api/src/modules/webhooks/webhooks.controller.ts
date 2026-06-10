import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { WebhooksService } from './webhooks.service.js'
import { CreateWebhookEndpointDto } from './webhooks.dto.js'

@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('/v1')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  // ----- Endpoints -----

  @RequireScopes('webhooks_write')
  @Post('/webhook-endpoints')
  @ApiOperation({ summary: 'Register a new webhook endpoint and return the signing secret once.' })
  createEndpoint(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Body() dto: CreateWebhookEndpointDto,
  ) {
    return this.webhooks.createEndpoint(ctx.merchantId, dto)
  }

  @RequireScopes('webhooks_read')
  @Get('/webhook-endpoints/:id')
  retrieveEndpoint(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.webhooks.retrieveEndpoint(ctx.merchantId, id)
  }

  @RequireScopes('webhooks_read')
  @Get('/webhook-endpoints')
  listEndpoints(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.webhooks.listEndpoints(ctx.merchantId, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ?? null,
    })
  }

  @RequireScopes('webhooks_write')
  @Post('/webhook-endpoints/:id/disable')
  disable(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.webhooks.setEndpointStatus(ctx.merchantId, id, 'disabled')
  }

  @RequireScopes('webhooks_write')
  @Post('/webhook-endpoints/:id/enable')
  enable(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.webhooks.setEndpointStatus(ctx.merchantId, id, 'active')
  }

  @RequireScopes('webhooks_write')
  @Post('/webhook-endpoints/:id/rotate-secret')
  @ApiOperation({ summary: 'Generate a fresh signing secret. Old secret immediately invalidated.' })
  rotateSecret(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.webhooks.rotateSecret(ctx.merchantId, id)
  }

  // ----- Deliveries -----

  @RequireScopes('webhooks_read')
  @Get('/webhook-deliveries/:id')
  retrieveDelivery(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.webhooks.retrieveDelivery(ctx.merchantId, id)
  }

  @RequireScopes('webhooks_read')
  @Get('/webhook-deliveries')
  listDeliveries(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('endpointId') endpointId?: string,
    @Query('status') status?: string,
    @Query('eventName') eventName?: string,
  ) {
    return this.webhooks.listDeliveries(ctx.merchantId, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ?? null,
      endpointId,
      status,
      eventName,
    })
  }

  @RequireScopes('webhooks_write')
  @Post('/webhook-deliveries/:id/replay')
  @ApiOperation({ summary: 'Re-enqueue a delivery onto the scheduler queue.' })
  replay(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.webhooks.replay(ctx.merchantId, id)
  }
}
