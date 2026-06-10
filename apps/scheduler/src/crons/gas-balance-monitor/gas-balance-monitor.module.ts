import { Module } from '@nestjs/common'

import { GasBalanceMonitorService } from './gas-balance-monitor.service.js'

@Module({
  providers: [GasBalanceMonitorService],
  exports: [GasBalanceMonitorService],
})
export class GasBalanceMonitorModule {}
