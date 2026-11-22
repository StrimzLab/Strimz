import { Module } from '@nestjs/common'
import { StepUpModule } from '../step-up/step-up.module.js'
import { WebhooksController } from './webhooks.controller.js'
import { WebhooksService } from './webhooks.service.js'

@Module({
  imports: [StepUpModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
