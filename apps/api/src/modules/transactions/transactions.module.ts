import { Module } from '@nestjs/common'
import { TransactionsController } from './transactions.controller.js'
import { TransactionsService } from './transactions.service.js'

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
