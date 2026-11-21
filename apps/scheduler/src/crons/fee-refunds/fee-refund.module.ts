import { Module } from '@nestjs/common'
import { RefundChainModule } from '../../infra/refund-chain/refund-chain.module.js'
import { FeeRefundService } from './fee-refund.service.js'

@Module({
  imports: [RefundChainModule],
  providers: [FeeRefundService],
  exports: [FeeRefundService],
})
export class FeeRefundModule {}
