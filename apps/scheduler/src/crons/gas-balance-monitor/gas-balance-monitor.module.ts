import { Module } from '@nestjs/common'

import { RefundChainModule } from '../../infra/refund-chain/refund-chain.module.js'
import { GasBalanceMonitorService } from './gas-balance-monitor.service.js'

@Module({
  imports: [RefundChainModule],
  providers: [GasBalanceMonitorService],
  exports: [GasBalanceMonitorService],
})
export class GasBalanceMonitorModule {}
