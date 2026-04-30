import { z } from 'zod'

/**
 * Strict env validation. Anything missing or malformed throws at boot — we
 * never run in a half-configured state because that's how service-wallet
 * keys get used against the wrong chain.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4200),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  ARC_ENVIRONMENT: z.enum(['testnet', 'mainnet']).default('testnet'),
  ARC_RPC_URL: z.string().url(),

  /**
   * Service-wallet private key. The ONLY process that holds one. Must be a
   * 0x-prefixed 32-byte hex string. Loaded from a secret manager in prod.
   */
  SCHEDULER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 0x-prefixed 32-byte hex private key'),

  SUBSCRIPTIONS_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed 20-byte hex address'),
  AGENT_ESCROW_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed 20-byte hex address'),

  STRIMZ_WEBHOOK_SIGNING_SECRET: z.string().min(32),
  WEBHOOK_DELIVERY_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),

  SUBSCRIPTION_SWEEPER_CRON: z.string().default('0 */15 * * * *'),
  INVOICE_OVERDUE_CRON: z.string().default('0 0 * * * *'),
  SUBSCRIPTION_SWEEP_LIMIT: z.coerce.number().int().min(1).max(10_000).default(100),
  SUBSCRIPTION_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default('noreply@strimz.io'),
})

export type Env = z.infer<typeof envSchema>

/**
 * `validate` is the function `@nestjs/config` calls; it must throw when
 * validation fails. Returns the parsed object so `.get` reads typed values.
 */
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
