import { Module } from '@nestjs/common'
import { MerchantsController } from './merchants.controller.js'
import { MerchantsService } from './merchants.service.js'

@Module({
  controllers: [MerchantsController],
  providers: [MerchantsService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
