import { Module } from '@nestjs/common'
import { InvoiceOverdueService } from './invoice-overdue.service.js'

@Module({
  providers: [InvoiceOverdueService],
  exports: [InvoiceOverdueService],
})
export class InvoiceOverdueModule {}
