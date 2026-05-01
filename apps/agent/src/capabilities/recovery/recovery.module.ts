import { Module } from '@nestjs/common'
import { RecoveryService } from './recovery.service.js'
import { RecoveryCron } from './recovery.cron.js'

@Module({ providers: [RecoveryService, RecoveryCron], exports: [RecoveryService] })
export class RecoveryModule {}
