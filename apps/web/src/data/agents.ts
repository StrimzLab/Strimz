import { daysAgo, id, mulberry32, pick, range, walletAddress } from './_seed'

export type AgentCapability =
  | 'recovery'
  | 'cashflow'
  | 'cashflow_anomaly'
  | 'cashflow_yield'
  | 'commerce'
  | 'pricing_intelligence'
  | 'routing'

export type AgentConfig = {
  enabledCapabilities: AgentCapability[]
  recovery: {
    gracePeriodHours: 24 | 48 | 72
    strategy: 'once' | 'twice' | 'until_grace_ends'
    notificationTemplate: string
  }
  cashflow: {
    digestEnabled: boolean
    anomalySensitivity: 'low' | 'medium' | 'high'
    autoConvertToYield: boolean
    minimumLiquidReserveUsdc: number
  }
  commerce: {
    requireHumanApprovalAboveUsdc: number
    monthlySpendCapUsdc: number
    approvedVendors: string[]
  }
}

export const AGENT_CONFIG: AgentConfig = {
  enabledCapabilities: [
    'recovery',
    'cashflow',
    'cashflow_anomaly',
    'pricing_intelligence',
    'routing',
  ],
  recovery: {
    gracePeriodHours: 48,
    strategy: 'twice',
    notificationTemplate:
      "Hey. Your subscription with us couldn't be charged. Top up and we'll retry automatically.",
  },
  cashflow: {
    digestEnabled: true,
    anomalySensitivity: 'medium',
    autoConvertToYield: false,
    minimumLiquidReserveUsdc: 50_000_000_000,
  },
  commerce: {
    requireHumanApprovalAboveUsdc: 1_000_000_000,
    monthlySpendCapUsdc: 5_000_000_000,
    approvedVendors: [],
  },
}

export type AgentActivity = {
  id: string
  capability: AgentCapability
  actionType: string
  outcome: 'success' | 'skipped' | 'failed'
  summary: string
  ref: string | null
  createdAt: string
}

const rngActivity = mulberry32(89)

export const AGENT_ACTIVITY: AgentActivity[] = range(36)
  .map((i) => {
    const cap = pick(rngActivity, [
      'recovery',
      'cashflow',
      'cashflow_anomaly',
      'pricing_intelligence',
      'routing',
    ] as AgentCapability[])
    const outcome = pick(rngActivity, [
      'success',
      'success',
      'success',
      'success',
      'skipped',
      'failed',
    ] as Array<AgentActivity['outcome']>)
    const summaries: Record<AgentCapability, [string, string]> = {
      recovery: ['recovery_notification_sent', 'Sent recovery email after failed charge'],
      cashflow: ['cashflow_digest_sent', 'Daily digest delivered'],
      cashflow_anomaly: ['cashflow_anomaly_detected', 'Hourly revenue 2.4σ below 30-day baseline'],
      cashflow_yield: [
        'cashflow_yield_recommended',
        'Surplus over reserve detected. Yield recommendation issued',
      ],
      commerce: ['commerce_monthly_summary_sent', 'Monthly vendor summary emailed'],
      pricing_intelligence: [
        'pricing_monthly_report_sent',
        'Monthly MRR + churn + forecast emailed',
      ],
      routing: ['routing_payment_completed', 'CCTP V2 settlement complete on Arc'],
    }
    const [actionType, summary] = summaries[cap]
    return {
      id: id('agact', i + 1),
      capability: cap,
      actionType,
      outcome,
      summary,
      ref:
        rngActivity() > 0.4
          ? id(cap === 'recovery' ? 'sub' : cap === 'routing' ? 'tx' : 'ev', i + 1)
          : null,
      createdAt: daysAgo(Math.floor(rngActivity() * 14), Math.floor(rngActivity() * 24)),
    }
  })
  .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))

export type AgentJobStatus =
  | 'proposed'
  | 'accepted'
  | 'in_progress'
  | 'delivered'
  | 'approved'
  | 'completed'
  | 'disputed'

export type AgentJob = {
  id: string
  vendor: string
  vendorWallet: string
  description: string
  amountUsdc: number
  status: AgentJobStatus
  createdAt: string
  requiresApproval: boolean
}

const rngJobs = mulberry32(127)
const VENDORS = [
  ['LinguaPro', 'Localisation services'],
  ['Auditworks', 'Quarterly security audit'],
  ['DesignHaus', 'Storefront UI refresh'],
  ['Watchtower', 'Monitoring setup'],
  ['MeshOps', 'Infra performance review'],
  ['CopyDesk', 'Marketing copywriting'],
] as const

export const AGENT_JOBS: AgentJob[] = range(8).map((i) => {
  const [vendor, desc] = VENDORS[i % VENDORS.length]!
  const amount = Math.floor(rngJobs() * 1_500_000_000) + 50_000_000
  const requiresApproval = amount > AGENT_CONFIG.commerce.requireHumanApprovalAboveUsdc
  return {
    id: id('job', i + 1),
    vendor,
    vendorWallet: walletAddress(rngJobs),
    description: desc,
    amountUsdc: amount,
    status: requiresApproval
      ? 'proposed'
      : pick(rngJobs, ['completed', 'in_progress', 'delivered', 'completed'] as AgentJobStatus[]),
    createdAt: daysAgo(Math.floor(rngJobs() * 30)),
    requiresApproval,
  }
})
