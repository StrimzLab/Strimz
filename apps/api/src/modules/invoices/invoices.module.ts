import { Module } from '@nestjs/common'
import { MerchantsModule } from '../merchants/merchants.module.js'
import { InvoicesController } from './invoices.controller.js'
import { InvoicesService } from './invoices.service.js'

@Module({
  imports: [MerchantsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
