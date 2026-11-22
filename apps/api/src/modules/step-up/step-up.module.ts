import { Module } from '@nestjs/common'

import { StepUpController } from './step-up.controller.js'
import { StepUpGuard } from './step-up.guard.js'
import { StepUpService } from './step-up.service.js'

@Module({
  controllers: [StepUpController],
  providers: [StepUpService, StepUpGuard],
  exports: [StepUpService, StepUpGuard],
})
export class StepUpModule {}
