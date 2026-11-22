import { createHash } from 'node:crypto'

import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import { erc20Abi, type Hex } from 'viem'
import type { TransactionSigner } from '@strimz/signer'

import { TypedConfigService } from '../../config/index.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { EmailService } from '../../infra/email/email.service.js'
import { KMS_SIGNER } from '../../infra/kms/kms.tokens.js'
import { RedisService } from '../../infra/redis/redis.service.js'

export type RelayUnavailableReason =
  | 'platform_paused'
  | 'merchant_quota'
  | 'payer_limited'
  | 'ip_limited'

/** The signed call, so the payer's own wallet can send it when Strimz won't pay the gas. */
export interface SelfPayCall {
  to: Hex
  data: Hex
  chainId: number
}

export type RelayKind = 'payment' | 'enrolment' | 'allowance' | 'cancel'

export interface RelayAdmission {
  kind: RelayKind
  payer: Hex
  merchantInternalId: string
  clientKey: string | null
  call: Omit<SelfPayCall, 'chainId'>
}

const DAY_SECONDS = 86_400
const ENROLMENTS_PER_PAYER = 3
const ENROLMENTS_PER_PAYER_PER_MERCHANT = 1
const ENROLMENTS_PER_IP_PER_MERCHANT = 10
const REVERTS_BEFORE_LIMIT = 2
const BALANCE_CACHE_SECONDS = 60
const BALANCE_KEY = 'relay:relayer-usdc'
const ALERT_STEPS = [0.5, 0.8, 1] as const

export function relayUnavailable(reason: RelayUnavailableReason, call: SelfPayCall): HttpException {
  return new HttpException(
    {
      code: 'relay_unavailable',
      message: "Strimz can't cover the network fee for this one; send it from your own wallet",
      details: { reason, call },
    },
    HttpStatus.PAYMENT_REQUIRED,
  )
}

/** A stable, non-reversible key for a client IP. The raw IP is never stored. */
export function clientKeyFor(ip: string | undefined): string | null {
  if (!ip) return null
  return createHash('sha256').update(`strimz-relay:${ip}`).digest('hex').slice(0, 16)
}

function utcDay(at = new Date()): string {
  return at.toISOString().slice(0, 10)
}

/**
 * Decides whether Strimz pays the gas for a relayed call (ADR-2026-11-21-relay-gas-protection).
 * Every refusal is a `relay_unavailable` that carries the call, so checkout can let the payer
 * send it and pay the gas themselves. An honest merchant never loses a payment to these limits.
 */
@Injectable()
export class RelayGuardService {
  private readonly log = new Logger(RelayGuardService.name)
  constructor(
    private readonly cfg: TypedConfigService,
    private readonly redis: RedisService,
    private readonly chain: ChainService,
    private readonly email: EmailService,
    @Inject(KMS_SIGNER) private readonly signer: TransactionSigner,
  ) {}

  /** Checks every limit without counting anything. Throws `relay_unavailable` on refusal. */
  async admit(admission: RelayAdmission): Promise<void> {
    const a = { ...admission, call: this.selfPayCall(admission.call) }
    const day = utcDay()
    const payer = a.payer.toLowerCase()

    if ((await this.count(`relay:reverts:payer:${payer}:${day}`)) >= REVERTS_BEFORE_LIMIT) {
      throw relayUnavailable('payer_limited', a.call)
    }
    if (
      a.clientKey &&
      (await this.count(`relay:reverts:ip:${a.clientKey}:${day}`)) >= REVERTS_BEFORE_LIMIT
    ) {
      throw relayUnavailable('ip_limited', a.call)
    }

    if (a.kind === 'enrolment') {
      if ((await this.count(`relay:enrol:payer:${payer}:${day}`)) >= ENROLMENTS_PER_PAYER) {
        throw relayUnavailable('payer_limited', a.call)
      }
      const perMerchant = `relay:enrol:payer:${payer}:m:${a.merchantInternalId}:${day}`
      if ((await this.count(perMerchant)) >= ENROLMENTS_PER_PAYER_PER_MERCHANT) {
        throw relayUnavailable('payer_limited', a.call)
      }
      if (
        a.clientKey &&
        (await this.count(`relay:enrol:ip:${a.clientKey}:m:${a.merchantInternalId}:${day}`)) >=
          ENROLMENTS_PER_IP_PER_MERCHANT
      ) {
        throw relayUnavailable('ip_limited', a.call)
      }
    }

    await this.assertPlatformOpen(a.call, day)
  }

  /**
   * Counts a call once the merchant's quota has taken it too, so refused calls
   * can't be used to fill the platform cap or a payer's signup count.
   */
  async commit(admission: RelayAdmission): Promise<void> {
    const day = utcDay()
    const payer = admission.payer.toLowerCase()
    const cap = this.cfg.env.RELAY_PLATFORM_DAILY_CAP
    const key = `relay:platform:${day}`
    const used = await this.redis.client.incr(key)
    if (used === 1) await this.redis.client.expire(key, 2 * DAY_SECONDS)
    for (const step of ALERT_STEPS) {
      if (used === Math.ceil(cap * step)) {
        await this.alertOnce(
          `relay:alert:platform:${day}:${step}`,
          `Relay platform cap at ${step * 100}% today`,
          `<p>${used} of ${cap} relayed submissions used on ${day} (UTC).${step === 1 ? ' Further payers send their own transactions until 00:00 UTC.' : ''}</p>`,
        )
      }
    }
    if (used > cap) {
      await this.redis.client.decr(key)
      throw this.unavailable('platform_paused', admission.call)
    }

    if (admission.kind === 'enrolment') {
      const m = admission.merchantInternalId
      await this.bump(`relay:enrol:payer:${payer}:${day}`)
      await this.bump(`relay:enrol:payer:${payer}:m:${m}:${day}`)
      if (admission.clientKey)
        await this.bump(`relay:enrol:ip:${admission.clientKey}:m:${m}:${day}`)
    }
  }

  /** The same call as a `relay_unavailable` refusal, for a caller that refuses after `admit`. */
  unavailable(reason: RelayUnavailableReason, call: Omit<SelfPayCall, 'chainId'>): HttpException {
    return relayUnavailable(reason, this.selfPayCall(call))
  }

  private selfPayCall(call: Omit<SelfPayCall, 'chainId'>): SelfPayCall {
    const chain = this.chain.client.chain
    if (!chain) throw new Error('relay guard: chain client has no chain bound')
    return { ...call, chainId: chain.id }
  }

  /** Privy refused to sign a relay: either a bug or someone using the server's key. */
  async alertSigningRefused(jobId: string, to: string): Promise<void> {
    await this.alertOnce(
      `relay:alert:signing-refused:${jobId}`,
      'Privy refused to sign a relay: check for misuse of the server key',
      `<p>Relay job <code>${jobId}</code> to <code>${to}</code> was refused by the relayer wallet's Privy policy. The job was stopped and not retried. If Strimz didn't change its contracts or calls, treat the server's Privy key as exposed and remove it from the wallet with the owner key.</p>`,
    )
  }

  /** A relayed call reverted on chain: count it against whoever sent it. */
  async recordRevert(payer: string | undefined, clientKey: string | undefined): Promise<void> {
    const day = utcDay()
    if (payer) await this.bump(`relay:reverts:payer:${payer.toLowerCase()}:${day}`)
    if (clientKey) await this.bump(`relay:reverts:ip:${clientKey}:${day}`)
  }

  private async assertPlatformOpen(call: SelfPayCall, day: string): Promise<void> {
    if ((await this.relayerUsdc()) < this.floor()) {
      await this.alertOnce(
        `relay:alert:floor:${day}`,
        'Relayer below its minimum balance: relaying is paused',
        `<p>The relayer <code>${this.signer.address}</code> holds less than ${this.cfg.env.RELAYER_MIN_BALANCE_USDC} USDC. Strimz has stopped paying gas; payers are asked to send their own transactions. Top the relayer up to resume.</p>`,
      )
      throw relayUnavailable('platform_paused', call)
    }

    if ((await this.count(`relay:platform:${day}`)) >= this.cfg.env.RELAY_PLATFORM_DAILY_CAP) {
      throw relayUnavailable('platform_paused', call)
    }
  }

  private floor(): bigint {
    return BigInt(Math.round(this.cfg.env.RELAYER_MIN_BALANCE_USDC * 1_000_000))
  }

  // Cached in Redis so every API instance reads the chain at most once a minute.
  private async relayerUsdc(): Promise<bigint> {
    const cached = await this.redis.client.get(BALANCE_KEY)
    if (cached !== null) return BigInt(cached)
    const usdcAddress = this.cfg.env.ARC_USDC_ADDRESS
    if (!usdcAddress) throw new Error('ARC_USDC_ADDRESS is not configured')
    const usdc = await this.chain.client.readContract({
      address: usdcAddress as Hex,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [this.signer.address],
    })
    await this.redis.client.set(BALANCE_KEY, usdc.toString(), 'EX', BALANCE_CACHE_SECONDS)
    return usdc
  }

  private async count(key: string): Promise<number> {
    return Number((await this.redis.client.get(key)) ?? 0)
  }

  private async bump(key: string): Promise<void> {
    const n = await this.redis.client.incr(key)
    if (n === 1) await this.redis.client.expire(key, 2 * DAY_SECONDS)
  }

  private async alertOnce(key: string, subject: string, html: string): Promise<void> {
    const claimed = await this.redis.client.set(key, '1', 'EX', 2 * DAY_SECONDS, 'NX')
    if (claimed !== 'OK') return
    this.log.error(subject)
    const to = this.cfg.env.OPS_ALERT_EMAIL
    if (!to) return
    await this.email
      .send({ to, subject, html, text: subject })
      .catch((err: unknown) =>
        this.log.error(`${subject}: alert email failed: ${(err as Error).message}`),
      )
  }
}
