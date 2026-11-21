import { Module } from '@nestjs/common'

import { MerchantsController } from './merchants.controller.js'
import { MerchantsService } from './merchants.service.js'
import { MerchantChainService } from './merchant-chain.service.js'
import { RegistrationCapService } from './registration-cap.service.js'

@Module({
  controllers: [MerchantsController],
  providers: [MerchantsService, MerchantChainService, RegistrationCapService],
  exports: [MerchantsService, MerchantChainService],
})
export class MerchantsModule {}
