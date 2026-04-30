import { Global, Module } from '@nestjs/common'
import { PrivyService } from './privy.service.js'

@Global()
@Module({
  providers: [PrivyService],
  exports: [PrivyService],
})
export class PrivyModule {}
