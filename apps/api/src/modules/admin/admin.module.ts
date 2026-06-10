import { Module } from '@nestjs/common'

import { AdminController } from './admin.controller.js'
import { AdminService } from './admin.service.js'

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
