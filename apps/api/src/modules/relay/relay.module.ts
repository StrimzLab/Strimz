import { Module } from '@nestjs/common'

import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js'
import { GasPricingService } from './gas-pricing.service.js'
import { NonceManager } from './nonce-manager.service.js'
import { RelayController } from './relay.controller.js'
import { RelayProcessor } from './relay.processor.js'
import { RelayService } from './relay.service.js'

/**
 * Meta-tx relay layer.
 *
 * Composition:
 *  - `RelayService` is the public entrypoint other modules consume.
 *    It encodes calldata and enqueues a BullMQ job.
 *  - `RelayProcessor` is the worker. It runs in the API process for v1
 *    (concurrency=1, single hot wallet). Will graduate to a separate
 *    `apps/relay-worker` process when volume justifies the operational
 *    split.
 *  - `NonceManager` + `GasPricingService` are internal helpers used by
 *    the worker.
 *
 * Dependencies pulled in transitively from global modules:
 *  - `KMS_SIGNER` token from KmsModule (the signing key)
 *  - `ChainService` from ChainModule (RPC client)
 *  - `RedisService` from RedisModule (BullMQ + nonce counter)
 *  - `QueueService` from QueueModule (BullMQ queue handle)
 */
@Module({
  imports: [SubscriptionsModule],
  controllers: [RelayController],
  providers: [NonceManager, GasPricingService, RelayService, RelayProcessor],
  // NonceManager + GasPricingService are exported so other call sites
  // (e.g. MerchantChainService) that sign from the same KMS key share
  // a single nonce sequence and gas-pricing source of truth.
  exports: [RelayService, NonceManager, GasPricingService],
})
export class RelayModule {}
