import { Global, Module } from '@nestjs/common'
import { WebhookSigningService } from './signing.service.js'
import { WebhookSecretCache } from './secret-cache.service.js'

@Global()
@Module({
  providers: [WebhookSigningService, WebhookSecretCache],
  exports: [WebhookSigningService, WebhookSecretCache],
})
export class WebhookSigningModule {}
