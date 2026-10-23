import { Module } from '@nestjs/common'
import { FeeDriftService } from './fee-drift.service.js'

@Module({
  providers: [FeeDriftService],
  exports: [FeeDriftService],
})
export class FeeDriftModule {}
