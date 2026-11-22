import { Module } from '@nestjs/common'
import { StepUpModule } from '../step-up/step-up.module.js'
import { MerchantsModule } from '../merchants/merchants.module.js'
import { ApiKeysController } from './api-keys.controller.js'
import { ApiKeysService } from './api-keys.service.js'

@Module({
  imports: [MerchantsModule, StepUpModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
