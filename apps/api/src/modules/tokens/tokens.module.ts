import { Module } from '@nestjs/common'

import { TokensController } from './tokens.controller.js'
import { TokensService } from './tokens.service.js'

/**
 * Public token metadata + capability endpoints. Backed by chain
 * reads against the configured ARC RPC; depends on `ChainService`
 * (global) and `TypedConfigService` (global).
 */
@Module({
  controllers: [TokensController],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}
