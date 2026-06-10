import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { GasBalanceAlertEmail, renderToHtml } from '@strimz/email-templates'
import { erc20Abi, formatUnits, type Address } from 'viem'

import { TypedConfigService } from '../../config/index.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { RedisService } from '../../infra/redis/redis.service.js'

/**
 * Gas-balance monitor.
 *
 * Arc charges gas in USDC. When the relayer or scheduler EOA's USDC
 * balance drops below `GAS_BALANCE_THRESHOLD_USDC`, the next
 * submission reverts with "insufficient funds for gas" and the
 * affected flow stalls silently — payments don't process, recurring
 * charges don't fire. Operators need to know before the user does.
 *
 * Edge-trigger semantics:
 *   - One alert fires when the balance crosses from above-threshold to
 *     below-threshold. Repeat ticks below-threshold do NOT re-alert.
 *   - The "alerted" state lives in Redis (24h TTL) so a restart
 *     doesn't replay a fresh alert for a still-low balance.
 *   - Once the balance climbs back above-threshold, the flag clears
 *     and the next dip will re-alert. Operators are notified each time
 *     they ignore the wallet, not on every tick.
 */
@Injectable()
export class GasBalanceMonitorService {
  private readonly log = new Logger(GasBalanceMonitorService.name)

  constructor(
    private readonly cfg: TypedConfigService,
    private readonly chain: ChainService,
    private readonly email: EmailService,
    private readonly redis: RedisService,
  ) {}

  @Cron(process.env.GAS_BALANCE_CRON || '0 */15 * * * *', { name: 'gas-balance-monitor' })
  async tick(): Promise<{ checked: number; alerted: number }> {
    return this.tickNow()
  }

  /** Exposed so the admin endpoint can step the cron deterministically. */
  async tickNow(): Promise<{ checked: number; alerted: number }> {
    const watchlist: Array<{ role: string; address: Address }> = [
      { role: 'relayer', address: this.cfg.env.RELAYER_ADDRESS as Address },
      { role: 'scheduler', address: this.chain.account.address },
    ]

    const usdc = this.cfg.env.ARC_USDC_ADDRESS as Address
    const thresholdRaw = BigInt(Math.floor(this.cfg.env.GAS_BALANCE_THRESHOLD_USDC * 1_000_000))

    let alerted = 0
    for (const { role, address } of watchlist) {
      const balanceRaw = await this.chain.publicClient.readContract({
        address: usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })

      const flagKey = `strimz:gas-balance-alert:${role}:${address.toLowerCase()}`
      const lowNow = balanceRaw < thresholdRaw
      const alreadyAlerted = (await this.redis.client.get(flagKey)) === '1'

      if (lowNow && !alreadyAlerted) {
        await this.sendAlert(role, address, balanceRaw, thresholdRaw)
        // 24h TTL is long enough that we don't spam if the operator is
        // away for a day, short enough that a forgotten alert clears.
        await this.redis.client.set(flagKey, '1', 'EX', 86_400)
        alerted++
      } else if (!lowNow && alreadyAlerted) {
        await this.redis.client.del(flagKey)
        this.log.log(`gas-balance ${role}=${address}: recovered above threshold`)
      }
    }

    return { checked: watchlist.length, alerted }
  }

  private async sendAlert(
    role: string,
    address: Address,
    balanceRaw: bigint,
    thresholdRaw: bigint,
  ): Promise<void> {
    const balanceUsdc = formatUnits(balanceRaw, 6)
    const thresholdUsdc = formatUnits(thresholdRaw, 6)
    const network = this.cfg.env.ARC_ENVIRONMENT === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'
    const faucetUrl =
      this.cfg.env.ARC_ENVIRONMENT === 'testnet' ? 'https://faucet.circle.com' : undefined

    const html = await renderToHtml(
      GasBalanceAlertEmail({
        role,
        address,
        balanceUsdc,
        thresholdUsdc,
        network,
        faucetUrl,
      }),
    )

    await this.email.send({
      to: this.cfg.env.STRIMZ_ADMIN_ALERT_EMAIL,
      subject: `[Strimz] ${network} ${role} balance is ${balanceUsdc} USDC`,
      html,
    })
    this.log.warn(
      `gas-balance ${role}=${address} below threshold (balance=${balanceUsdc} USDC, threshold=${thresholdUsdc} USDC) — alerted ${this.cfg.env.STRIMZ_ADMIN_ALERT_EMAIL}`,
    )
  }
}
