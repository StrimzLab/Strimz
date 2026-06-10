import { Controller, ForbiddenException, Logger, NotFoundException, Post } from '@nestjs/common'

import { TypedConfigService } from '../../config/index.js'
import { SubscriptionSweeperService } from '../../crons/subscription-sweeper/subscription-sweeper.service.js'
import { GasBalanceMonitorService } from '../../crons/gas-balance-monitor/gas-balance-monitor.service.js'
import { MerchantNotificationsService } from '../../crons/merchant-notifications/merchant-notifications.service.js'

/**
 * Out-of-band triggers for the cron workloads, exposed only when
 * `NODE_ENV !== 'production'`. The same operations run on cron in
 * every environment; this surface exists so local-dev and CI can step
 * the schedule deterministically (curl + assert) instead of waiting
 * for the cron tick.
 *
 * In production the routes 404 — the handler refuses to dispatch and
 * Nest's exception filter renders a generic not-found body. No
 * privileged action ever ships behind a flag that could be misread
 * as "off" in prod.
 */
@Controller('/admin')
export class AdminController {
  private readonly log = new Logger(AdminController.name)

  constructor(
    private readonly cfg: TypedConfigService,
    private readonly sweeper: SubscriptionSweeperService,
    private readonly gasMonitor: GasBalanceMonitorService,
    private readonly merchantNotifications: MerchantNotificationsService,
  ) {}

  @Post('/sweep-now')
  async sweepNow(): Promise<{ enqueued: number }> {
    this.refuseInProduction()
    this.log.log('admin: manual sweep triggered')
    return this.sweeper.sweepNow()
  }

  @Post('/run/gas-balance-monitor')
  async runGasBalanceMonitor() {
    this.refuseInProduction()
    this.log.log('admin: manual gas-balance monitor triggered')
    return this.gasMonitor.tickNow()
  }

  @Post('/run/merchant-notifications')
  async runMerchantNotifications() {
    this.refuseInProduction()
    this.log.log('admin: manual merchant-notifications cron triggered')
    return this.merchantNotifications.tickNow()
  }

  private refuseInProduction(): void {
    if (this.cfg.env.NODE_ENV === 'production') {
      // 404 instead of 403 — admin endpoints don't advertise their
      // existence to unauthorised callers.
      throw new NotFoundException()
    }
    if (this.cfg.env.NODE_ENV !== 'development' && this.cfg.env.NODE_ENV !== 'test') {
      throw new ForbiddenException({ code: 'permission_denied' })
    }
  }
}
