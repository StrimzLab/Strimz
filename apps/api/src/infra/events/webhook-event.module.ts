import { Global, Module } from '@nestjs/common'
import { WebhookEventService } from './webhook-event.service.js'

@Global()
@Module({
  providers: [WebhookEventService],
  exports: [WebhookEventService],
})
export class WebhookEventModule {}
