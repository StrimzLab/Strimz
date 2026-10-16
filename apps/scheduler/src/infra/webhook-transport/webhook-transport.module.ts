import { Module } from '@nestjs/common'
import { WebhookTargetPolicy } from './webhook-target-policy.js'
import { WebhookTransport } from './webhook-transport.service.js'

@Module({
  providers: [WebhookTargetPolicy, WebhookTransport],
  exports: [WebhookTransport],
})
export class WebhookTransportModule {}
