import { Global, Module } from '@nestjs/common'
import { WebhookSigningService } from './signing.service.js'
import { WebhookSecretCache } from './secret-cache.service.js'
import { WebhookSecretWarmupService } from './secret-warmup.service.js'

@Global()
@Module({
  providers: [WebhookSigningService, WebhookSecretCache, WebhookSecretWarmupService],
  exports: [WebhookSigningService, WebhookSecretCache],
})
export class WebhookSigningModule {}
