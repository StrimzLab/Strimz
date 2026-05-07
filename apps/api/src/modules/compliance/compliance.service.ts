import { Injectable, Logger } from '@nestjs/common'
import type {
  ComplianceLog,
  ComplianceProvider,
  ComplianceScreeningContext,
  ComplianceStatus,
} from '@strimz/shared-types'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { TypedConfigService } from '../../config/index.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ScreenInput {
  walletAddress: string
  context: ComplianceScreeningContext
  merchantId?: string | null
  sessionId?: string | null
  subscriptionId?: string | null
}

export interface ScreenResult {
  status: ComplianceStatus
  riskScore: number | null
  flags: string[]
  log: ComplianceLog
}

/**
 * Compliance / sanctions screening for payer wallets.
 *
 * Provider-agnostic: TRM Labs and Elliptic both expose similar
 * "screen wallet, return risk" endpoints. The adapter pattern means we
 * pick the active provider via env (`COMPLIANCE_PROVIDER`) and never
 * leak vendor-specific shapes upwards.
 *
 * `disabled` mode: every screen returns `clear` with no risk score.
 * Suitable for testnet and local dev where compliance APIs are noise.
 */
@Injectable()
export class ComplianceService {
  private readonly log = new Logger(ComplianceService.name)
  private readonly provider: ComplianceProvider
  private readonly apiKey: string | undefined
  private readonly blockThreshold: number

  constructor(
    private readonly prisma: PrismaService,
    cfg: TypedConfigService,
  ) {
    this.provider = cfg.env.COMPLIANCE_PROVIDER
    this.apiKey = cfg.env.COMPLIANCE_API_KEY
    this.blockThreshold = cfg.env.COMPLIANCE_BLOCK_THRESHOLD
    if (this.provider !== 'disabled' && !this.apiKey) {
      this.log.warn(
        `COMPLIANCE_PROVIDER=${this.provider} but no COMPLIANCE_API_KEY set — screening will fail open.`,
      )
    }
  }

  async screen(input: ScreenInput): Promise<ScreenResult> {
    const { status, riskScore, flags, providerRequestId } = await this.callProvider(
      input.walletAddress,
    )

    const row = await this.prisma.db.complianceLog.create({
      data: {
        walletAddress: input.walletAddress.toLowerCase(),
        provider: this.provider,
        status,
        riskScore,
        flags,
        context: input.context,
        merchantId: input.merchantId ?? null,
        sessionId: input.sessionId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        providerRequestId,
      },
    })

    return { status, riskScore, flags, log: serialise(row) }
  }

  async listLogs(
    merchantId: string,
    params: { limit?: number; cursor?: string | null; status?: string },
  ) {
    const limit = Math.min(params.limit ?? 25, 100)
    const rows = await this.prisma.db.complianceLog.findMany({
      where: {
        merchantId,
        status: (params.status as never) ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    })
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map(serialise)
    return { data, nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, hasMore }
  }

  // ----- Provider adapters -----

  private async callProvider(walletAddress: string): Promise<{
    status: ComplianceStatus
    riskScore: number | null
    flags: string[]
    providerRequestId: string | null
  }> {
    if (this.provider === 'disabled' || !this.apiKey) {
      return { status: 'clear', riskScore: null, flags: [], providerRequestId: null }
    }
    if (this.provider === 'trm') return this.callTrm(walletAddress)
    if (this.provider === 'elliptic') return this.callElliptic(walletAddress)
    return { status: 'clear', riskScore: null, flags: [], providerRequestId: null }
  }

  private async callTrm(walletAddress: string): Promise<{
    status: ComplianceStatus
    riskScore: number | null
    flags: string[]
    providerRequestId: string | null
  }> {
    try {
      const res = await fetch('https://api.trmlabs.com/public/v2/screening/addresses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ address: walletAddress, chain: 'ethereum' }]),
      })
      if (!res.ok) {
        this.log.warn(`TRM screen returned ${res.status}; failing open`)
        return { status: 'error', riskScore: null, flags: [], providerRequestId: null }
      }
      const json = (await res.json()) as Array<{
        addressRiskIndicators?: Array<{ category?: string }>
        addressSubmitted?: string
        accountExternalId?: string
        risk?: { score?: number }
      }>
      const first = json[0]
      const indicators = first?.addressRiskIndicators ?? []
      const flags = indicators.map((i) => i.category ?? '').filter(Boolean)
      const riskScore = first?.risk?.score ?? null
      const status: ComplianceStatus =
        riskScore != null && riskScore >= this.blockThreshold
          ? 'blocked'
          : flags.length > 0
            ? 'flagged'
            : 'clear'
      return { status, riskScore, flags, providerRequestId: first?.accountExternalId ?? null }
    } catch (err) {
      this.log.error(`TRM error: ${(err as Error).message}`)
      return { status: 'error', riskScore: null, flags: [], providerRequestId: null }
    }
  }

  private async callElliptic(walletAddress: string): Promise<{
    status: ComplianceStatus
    riskScore: number | null
    flags: string[]
    providerRequestId: string | null
  }> {
    try {
      const res = await fetch('https://aml-api.elliptic.co/v2/wallet/synchronous', {
        method: 'POST',
        headers: {
          'x-access-key': this.apiKey ?? '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: { hash: walletAddress, asset: 'holistic', type: 'address' },
          type: 'wallet_exposure',
          customer_reference: walletAddress,
        }),
      })
      if (!res.ok) {
        this.log.warn(`Elliptic screen returned ${res.status}; failing open`)
        return { status: 'error', riskScore: null, flags: [], providerRequestId: null }
      }
      const json = (await res.json()) as {
        risk_score?: number
        evaluation_detail?: { rule_name?: string }[]
        analysed_at?: string
      }
      const riskScore = typeof json.risk_score === 'number' ? json.risk_score : null
      const flags = (json.evaluation_detail ?? []).map((r) => r.rule_name ?? '').filter(Boolean)
      const status: ComplianceStatus =
        riskScore != null && riskScore >= this.blockThreshold
          ? 'blocked'
          : flags.length > 0
            ? 'flagged'
            : 'clear'
      return { status, riskScore, flags, providerRequestId: json.analysed_at ?? null }
    } catch (err) {
      this.log.error(`Elliptic error: ${(err as Error).message}`)
      return { status: 'error', riskScore: null, flags: [], providerRequestId: null }
    }
  }
}

function serialise(row: any): ComplianceLog {
  return {
    id: row.id,
    walletAddress: row.walletAddress,
    provider: row.provider,
    status: row.status,
    riskScore: row.riskScore,
    flags: row.flags,
    context: row.context,
    merchantId: row.merchantId,
    sessionId: row.sessionId,
    subscriptionId: row.subscriptionId,
    providerRequestId: row.providerRequestId,
    createdAt: row.createdAt.toISOString(),
  }
}
