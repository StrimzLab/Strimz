import { Controller, ForbiddenException, Logger, NotFoundException, Post } from '@nestjs/common'

import { TypedConfigService } from '../../config/index.js'
import { RecoveryService } from '../../capabilities/recovery/recovery.service.js'
import { CashflowDigestService } from '../../capabilities/cashflow/digest.service.js'
import { CashflowAnomalyService } from '../../capabilities/cashflow/anomaly.service.js'
import { CashflowYieldService } from '../../capabilities/cashflow/yield-recommendation.service.js'
import { CommerceService } from '../../capabilities/commerce/commerce.service.js'
import { PricingService } from '../../capabilities/pricing/pricing.service.js'

/**
 * Out-of-band cron triggers for local dev and CI smoke tests. Mirrors the
 * patterns the underlying capabilities run on cron in every environment;
 * this surface only exists so a `curl` from the developer's terminal can
 * step the schedule deterministically instead of waiting for, e.g., the
 * 1st-of-month commerce report.
 *
 * In production the routes 404. Nothing privileged ships behind a flag
 * that could be misread as "off" in prod.
 */
@Controller('/admin')
export class AdminController {
  private readonly log = new Logger(AdminController.name)

  constructor(
    private readonly cfg: TypedConfigService,
    private readonly recovery: RecoveryService,
    private readonly digest: CashflowDigestService,
    private readonly anomaly: CashflowAnomalyService,
    private readonly yieldRec: CashflowYieldService,
    private readonly commerce: CommerceService,
    private readonly pricing: PricingService,
  ) {}

  @Post('/run/recovery-tick')
  async runRecovery() {
    this.refuseInProduction()
    this.log.log('admin: manual recovery tick')
    return this.recovery.tick()
  }

  @Post('/run/cashflow-digest')
  async runCashflowDigest() {
    this.refuseInProduction()
    this.log.log('admin: manual cashflow digest')
    return this.digest.tick()
  }

  @Post('/run/cashflow-anomaly')
  async runCashflowAnomaly() {
    this.refuseInProduction()
    this.log.log('admin: manual cashflow anomaly')
    return this.anomaly.tick()
  }

  @Post('/run/cashflow-yield')
  async runCashflowYield() {
    this.refuseInProduction()
    this.log.log('admin: manual cashflow yield')
    return this.yieldRec.tick()
  }

  @Post('/run/commerce-monthly')
  async runCommerce() {
    this.refuseInProduction()
    this.log.log('admin: manual commerce monthly')
    return this.commerce.tick()
  }

  @Post('/run/pricing-monthly')
  async runPricing() {
    this.refuseInProduction()
    this.log.log('admin: manual pricing monthly')
    return this.pricing.tick()
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
