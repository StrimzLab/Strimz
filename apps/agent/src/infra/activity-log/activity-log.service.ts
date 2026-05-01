import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service.js'

/** Maps to `AgentCapability` enum on the Postgres side. */
export type AgentCapability =
  | 'identity'
  | 'recovery'
  | 'routing'
  | 'cashflow'
  | 'commerce'
  | 'pricing_intelligence'

/** Maps to `AgentActionType` enum. */
export type AgentActionType =
  | 'recovery_notification_sent'
  | 'recovery_retry_scheduled'
  | 'recovery_retry_executed'
  | 'recovery_abandoned'
  | 'routing_bridge_initiated'
  | 'routing_payment_completed'
  | 'cashflow_digest_sent'
  | 'cashflow_anomaly_flagged'
  | 'cashflow_yield_converted'
  | 'commerce_job_created'
  | 'commerce_job_approved'
  | 'commerce_job_completed'
  | 'commerce_job_disputed'

export type AgentActionOutcome = 'success' | 'failure' | 'pending' | 'skipped'

/**
 * Single insertion point for `AgentActivityLog` rows. Every capability
 * writes through here so:
 *
 *   - the dashboard sees a chronological feed regardless of which
 *     capability acted,
 *   - tests can assert on agent activity without coupling to the
 *     specific service that emitted it,
 *   - we never miss enum-mapping (capability/actionType/outcome are
 *     all typed at this boundary).
 */
@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    merchantId: string
    capability: AgentCapability
    actionType: AgentActionType
    outcome: AgentActionOutcome
    subscriptionId?: string | null
    transactionId?: string | null
    jobId?: string | null
    metadata?: Record<string, unknown>
  }): Promise<void> {
    await this.prisma.db.agentActivityLog.create({
      data: {
        merchantId: input.merchantId,
        capability: input.capability,
        actionType: input.actionType,
        outcome: input.outcome,
        subscriptionId: input.subscriptionId ?? null,
        transactionId: input.transactionId ?? null,
        jobId: input.jobId ?? null,
        metadata: (input.metadata ?? {}) as never,
      },
    })
  }

  /**
   * Returns true when an `AgentActivityLog` entry already exists for
   * the (subscription, actionType) pair. Used by recovery to avoid
   * sending the same notification twice.
   */
  async hasRecentForSubscription(input: {
    subscriptionId: string
    actionType: AgentActionType
    sinceMs: number
  }): Promise<boolean> {
    const since = new Date(Date.now() - input.sinceMs)
    const found = await this.prisma.db.agentActivityLog.findFirst({
      where: {
        subscriptionId: input.subscriptionId,
        actionType: input.actionType,
        createdAt: { gte: since },
      },
      select: { id: true },
    })
    return found != null
  }
}
