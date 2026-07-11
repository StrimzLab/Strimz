import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { PrivyWebhookController } from './privy-webhook.controller.js'
import { PrivyWebhookService } from './privy-webhook.service.js'
import { MerchantsModule } from '../merchants/merchants.module.js'

@Module({
  imports: [MerchantsModule],
  controllers: [AuthController, PrivyWebhookController],
  providers: [AuthService, PrivyWebhookService],
  exports: [AuthService],
})
export class AuthModule {}
