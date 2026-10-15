import { Module } from '@nestjs/common'
import { PlanUpgradeService } from './plan-upgrade.service.js'

@Module({
  providers: [PlanUpgradeService],
  exports: [PlanUpgradeService],
})
export class PlanUpgradeModule {}
