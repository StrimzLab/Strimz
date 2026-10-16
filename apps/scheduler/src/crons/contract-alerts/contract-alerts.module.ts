import { Module } from '@nestjs/common'
import { ContractAlertService } from './contract-alerts.service.js'

@Module({
  providers: [ContractAlertService],
  exports: [ContractAlertService],
})
export class ContractAlertModule {}
