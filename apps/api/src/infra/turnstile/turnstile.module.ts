import { Global, Module } from '@nestjs/common'
import { TurnstileService } from './turnstile.service.js'

@Global()
@Module({
  providers: [TurnstileService],
  exports: [TurnstileService],
})
export class TurnstileModule {}
