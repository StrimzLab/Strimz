import { Module } from '@nestjs/common'

import { RelayModule } from '../relay/relay.module.js'
import { SafeController } from './safe.controller.js'
import { SafeService } from './safe.service.js'

@Module({
  imports: [RelayModule],
  controllers: [SafeController],
  providers: [SafeService],
})
export class SafeModule {}
