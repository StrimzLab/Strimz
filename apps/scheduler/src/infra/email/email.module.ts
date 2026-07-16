import { Global, Module } from '@nestjs/common'
import { EmailService } from './email.service.js'
import { EmailBudgetService } from './email-budget.service.js'

@Global()
@Module({
  providers: [EmailService, EmailBudgetService],
  exports: [EmailService, EmailBudgetService],
})
export class EmailModule {}
