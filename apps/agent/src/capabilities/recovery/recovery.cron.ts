import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { RecoveryService } from './recovery.service.js'

@Injectable()
export class RecoveryCron {
  private readonly log = new Logger(RecoveryCron.name)

  constructor(private readonly recovery: RecoveryService) {}

  @Cron(process.env.RECOVERY_TICK_CRON || '0 0 * * * *', { name: 'recovery-tick' })
  async tick(): Promise<void> {
    const result = await this.recovery.tick()
    this.log.log(`recovery tick: notified=${result.notified} skipped=${result.skipped}`)
  }
}
