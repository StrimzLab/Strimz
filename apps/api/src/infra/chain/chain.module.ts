import { Global, Module } from '@nestjs/common'
import { ChainService } from './chain.service.js'

@Global()
@Module({
  providers: [ChainService],
  exports: [ChainService],
})
export class ChainModule {}
