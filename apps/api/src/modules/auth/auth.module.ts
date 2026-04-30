import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { MerchantsModule } from '../merchants/merchants.module.js'

@Module({
  imports: [MerchantsModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
