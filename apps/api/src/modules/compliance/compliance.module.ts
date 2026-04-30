import { Global, Module } from '@nestjs/common'
import { ComplianceController } from './compliance.controller.js'
import { ComplianceService } from './compliance.service.js'

@Global()
@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
