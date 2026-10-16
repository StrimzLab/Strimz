import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { TypedConfigService } from '../../config/index.js'
import { scheduleCron } from '../../common/cron/schedule-cron.js'
import { RecoveryService } from './recovery.service.js'

@Injectable()
export class RecoveryCron implements OnApplicationBootstrap {
  private readonly log = new Logger(RecoveryCron.name)

  constructor(
    private readonly recovery: RecoveryService,
    private readonly cfg: TypedConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    scheduleCron(
      this.scheduler,
      'recovery-tick',
      this.cfg.env.RECOVERY_TICK_CRON,
      () => this.tick(),
      this.log,
    )
  }

  async tick(): Promise<void> {
    const result = await this.recovery.tick()
    this.log.log(`recovery tick: notified=${result.notified} skipped=${result.skipped}`)
  }
}
