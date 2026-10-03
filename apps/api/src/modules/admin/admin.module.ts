import { Module } from '@nestjs/common'

import { AdminController, AdminInvitesController } from './admin.controller.js'
import { AdminService } from './admin.service.js'

@Module({
  controllers: [AdminController, AdminInvitesController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
