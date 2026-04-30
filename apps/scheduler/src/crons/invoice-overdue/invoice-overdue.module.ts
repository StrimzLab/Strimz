import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { QUEUE_NAMES } from '../../infra/queue/queue-names.js'
import { InvoiceOverdueService } from './invoice-overdue.service.js'

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.webhookDelivery })],
  providers: [InvoiceOverdueService],
  exports: [InvoiceOverdueService],
})
export class InvoiceOverdueModule {}
