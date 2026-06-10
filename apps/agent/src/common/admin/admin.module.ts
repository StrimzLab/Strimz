import { Module } from '@nestjs/common'

import { CashflowModule } from '../../capabilities/cashflow/cashflow.module.js'
import { CommerceModule } from '../../capabilities/commerce/commerce.module.js'
import { PricingModule } from '../../capabilities/pricing/pricing.module.js'
import { RecoveryModule } from '../../capabilities/recovery/recovery.module.js'
import { AdminController } from './admin.controller.js'

@Module({
  imports: [RecoveryModule, CashflowModule, CommerceModule, PricingModule],
  controllers: [AdminController],
})
export class AdminModule {}
