import { Module } from '@nestjs/common'

import { MerchantsModule } from '../merchants/merchants.module.js'

import { AdminController, AdminInvitesController } from './admin.controller.js'
import { AdminService } from './admin.service.js'

@Module({
  imports: [MerchantsModule],
  controllers: [AdminController, AdminInvitesController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
