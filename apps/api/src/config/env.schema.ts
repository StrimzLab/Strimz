import { z } from 'zod'

/**
 * Strict Zod schema for the API's runtime environment.
 * Loaded once at boot, validated, and exposed via TypedConfigService.
 * If a required variable is missing or malformed, the process refuses to start.
 */
export const envSchema = z.object({
  // ----- Runtime -----
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),

  // ----- Database / Redis -----
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  // ----- Privy (merchant dashboard auth) -----
  PRIVY_APP_ID: z.string().min(1, 'PRIVY_APP_ID is required'),
  PRIVY_APP_SECRET: z.string().min(16, 'PRIVY_APP_SECRET must be at least 16 characters'),
  PRIVY_VERIFICATION_KEY: z.string().optional(),

  // ----- Cloudflare Turnstile (bot protection on signup) -----
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // ----- Webhook signing -----
  STRIMZ_WEBHOOK_SIGNING_SECRET: z
    .string()
    .min(32, 'webhook signing secret must be at least 32 characters'),

  // ----- Email (Resend) -----
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default('noreply@strimz.io'),

  // ----- Chain -----
  ARC_ENVIRONMENT: z.enum(['testnet', 'mainnet']).default('testnet'),
  ARC_RPC_URL: z.string().url(),
  STRIMZ_REGISTRY_ADDRESS: z.string().optional(),
  STRIMZ_PAYMENTS_ADDRESS: z.string().optional(),
  STRIMZ_SUBSCRIPTIONS_ADDRESS: z.string().optional(),
  STRIMZ_FEE_COLLECTOR_ADDRESS: z.string().optional(),
  STRIMZ_TOKEN_WHITELIST_ADDRESS: z.string().optional(),

  // ----- Compliance -----
  COMPLIANCE_PROVIDER: z.enum(['trm', 'elliptic', 'disabled']).default('disabled'),
  COMPLIANCE_API_KEY: z.string().optional(),
  COMPLIANCE_BLOCK_THRESHOLD: z.coerce.number().int().min(0).max(100).default(80),

  // ----- Hosted checkout origin (for embed postMessage allow-list) -----
  CHECKOUT_ORIGIN: z.string().url().default('http://localhost:3000'),

  // ----- Observability -----
  SENTRY_DSN: z.string().optional(),

  // ----- CORS -----
  CORS_ORIGIN: z.string().default('*'),
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
