import { Global, Module } from '@nestjs/common'
import { ChainRegistryService } from './chain-registry.service.js'

/**
 * Makes `ChainRegistryService` available everywhere without each
 * feature module declaring it explicitly — same pattern as
 * `PrismaModule`. Marked `@Global` because chain-aware operations
 * appear in every module (sessions, subscriptions, refunds, agents).
 */
@Global()
@Module({
  providers: [ChainRegistryService],
  exports: [ChainRegistryService],
})
export class ChainRegistryModule {}
