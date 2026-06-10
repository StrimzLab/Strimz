import { Module } from '@nestjs/common'

import { MerchantsController } from './merchants.controller.js'
import { MerchantsService } from './merchants.service.js'
import { MerchantChainService } from './merchant-chain.service.js'
import { RelayModule } from '../relay/relay.module.js'

@Module({
  imports: [RelayModule],
  controllers: [MerchantsController],
  providers: [MerchantsService, MerchantChainService],
  exports: [MerchantsService, MerchantChainService],
})
export class MerchantsModule {}
