import { Module } from '@nestjs/common'

import { GasBalanceMonitorModule } from '../../crons/gas-balance-monitor/gas-balance-monitor.module.js'
import { MerchantNotificationsModule } from '../../crons/merchant-notifications/merchant-notifications.module.js'
import { SubscriptionSweeperModule } from '../../crons/subscription-sweeper/subscription-sweeper.module.js'
import { FeeRefundModule } from '../../crons/fee-refunds/fee-refund.module.js'
import { AdminController } from './admin.controller.js'

@Module({
  imports: [
    SubscriptionSweeperModule,
    GasBalanceMonitorModule,
    MerchantNotificationsModule,
    FeeRefundModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
