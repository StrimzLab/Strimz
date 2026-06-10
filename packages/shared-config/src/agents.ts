/**
 * Strimz AutoPay Agent feature flags and defaults.
 *
 * The agent is composed of independent capabilities that can be enabled or
 * disabled per merchant. Defaults are conservative. Merchants opt in to
 * value-moving capabilities (recovery retries, treasury auto-convert).
 */

export type AgentCapability =
  | 'identity'
  | 'recovery'
  | 'routing'
  | 'cashflow'
  | 'commerce'
  | 'pricing_intelligence'

export interface AgentCapabilityDescriptor {
  id: AgentCapability
  name: string
  /** Whether the capability moves money or signs transactions. */
  valueMoving: boolean
  /** Default enabled state for a newly created merchant. */
  defaultEnabled: boolean
}

export const AGENT_CAPABILITIES: Record<AgentCapability, AgentCapabilityDescriptor> = {
  identity: {
    id: 'identity',
    name: 'Agent Identity (ERC-8004)',
    valueMoving: false,
    defaultEnabled: true,
  },
  recovery: {
    id: 'recovery',
    name: 'Subscription Recovery',
    valueMoving: true,
    defaultEnabled: false,
  },
  routing: {
    id: 'routing',
    name: 'Cross-Chain Payment Routing',
    valueMoving: true,
    defaultEnabled: false,
  },
  cashflow: {
    id: 'cashflow',
    name: 'Treasury Cash Flow Insights',
    valueMoving: false,
    defaultEnabled: false,
  },
  commerce: {
    id: 'commerce',
    name: 'Agentic B2B Commerce (ERC-8183)',
    valueMoving: true,
    defaultEnabled: false,
  },
  pricing_intelligence: {
    id: 'pricing_intelligence',
    name: 'Subscription Pricing Intelligence',
    valueMoving: false,
    defaultEnabled: false,
  },
}

export type GracePeriodHours = 24 | 48 | 72

export const RECOVERY_GRACE_PERIODS: readonly GracePeriodHours[] = [24, 48, 72] as const

export type RecoveryRetryStrategy = 'once' | 'twice' | 'until_grace_ends'

export interface AgentDefaultConfig {
  recovery: {
    gracePeriodHours: GracePeriodHours
    strategy: RecoveryRetryStrategy
  }
  cashflow: {
    digestEnabled: boolean
    anomalySensitivity: 'low' | 'medium' | 'high'
    autoConvertToYield: boolean
  }
  commerce: {
    requireHumanApprovalAboveUsdCents: number
  }
}

export const AGENT_DEFAULTS: AgentDefaultConfig = {
  recovery: {
    gracePeriodHours: 48,
    strategy: 'twice',
  },
  cashflow: {
    digestEnabled: false,
    anomalySensitivity: 'medium',
    autoConvertToYield: false,
  },
  commerce: {
    requireHumanApprovalAboveUsdCents: 100_000, // $1,000
  },
}

/** Time-to-live for the agent activity log, in days. */
export const AGENT_ACTIVITY_LOG_RETENTION_DAYS = 90
