import { Module } from '@nestjs/common'
import { RefundsController } from './refunds.controller.js'
import { RefundsService } from './refunds.service.js'

@Module({
  controllers: [RefundsController],
  providers: [RefundsService],
  exports: [RefundsService],
})
export class RefundsModule {}
