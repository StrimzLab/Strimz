import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAMES } from '@strimz/queue-contracts'
import { RegistrationRetryService } from './registration-retry.service.js'

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.relaySubmission })],
  providers: [RegistrationRetryService],
  exports: [RegistrationRetryService],
})
export class RegistrationRetryModule {}
