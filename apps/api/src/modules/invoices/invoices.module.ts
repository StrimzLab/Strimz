import { Module } from '@nestjs/common'
import { InvoicesController } from './invoices.controller.js'
import { InvoicesService } from './invoices.service.js'

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
