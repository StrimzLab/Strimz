import { Module } from '@nestjs/common'
import { RefundReconcilerService } from './refund-reconciler.service.js'

@Module({
  providers: [RefundReconcilerService],
  exports: [RefundReconcilerService],
})
export class RefundReconcilerModule {}
