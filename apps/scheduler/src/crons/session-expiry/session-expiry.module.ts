import { Module } from '@nestjs/common'
import { SessionExpiryService } from './session-expiry.service.js'

@Module({
  providers: [SessionExpiryService],
  exports: [SessionExpiryService],
})
export class SessionExpiryModule {}
