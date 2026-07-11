import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { NotificationsService } from './notifications.service.js'

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('/v1/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List recent notifications for the current merchant. Derived from recent confirmed payments, new subscribers, and refunds; read state resolved against the merchant`s notificationsLastReadAt.',
  })
  list(@CurrentMerchant() ctx: CurrentMerchantPayload, @Query('limit') limit?: string) {
    return this.notifications.list(ctx.merchantId, limit ? Number(limit) : 20)
  }

  @Post('/mark-all-read')
  @ApiOperation({
    summary:
      'Set notificationsLastReadAt = now(). Called by the dashboard tray when the merchant opens it.',
  })
  markAllRead(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.notifications.markAllRead(ctx.merchantId)
  }
}
