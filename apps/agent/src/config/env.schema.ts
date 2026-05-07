import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4300),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  ARC_ENVIRONMENT: z.enum(['testnet', 'mainnet']).default('testnet'),
  ARC_RPC_URL: z.string().url(),

  RECOVERY_TICK_CRON: z.string().default('0 0 * * * *'),
  CASHFLOW_DIGEST_CRON: z.string().default('0 0 9 * * *'),
  CASHFLOW_ANOMALY_CRON: z.string().default('0 0 * * * *'),
  CASHFLOW_YIELD_CRON: z.string().default('0 30 9 * * *'),
  COMMERCE_MONTHLY_CRON: z.string().default('0 0 9 1 * *'),
  PRICING_MONTHLY_CRON: z.string().default('0 0 9 1 * *'),

  ANOMALY_THRESHOLD_LOW: z.coerce.number().positive().default(3.0),
  ANOMALY_THRESHOLD_MEDIUM: z.coerce.number().positive().default(2.0),
  ANOMALY_THRESHOLD_HIGH: z.coerce.number().positive().default(1.0),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default('noreply@strimz.io'),

  // Circle CCTP V2 — used by the routing capability to fetch attestations.
  // Default to Circle's sandbox; mainnet deployments override.
  CIRCLE_ATTESTATION_BASE_URL: z.string().url().default('https://iris-api-sandbox.circle.com'),
  CIRCLE_API_KEY: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  return parsed.data
}
