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
  /**
   * 32-byte hex (= 64 chars) AES-256-GCM key. Must match the API's
   * `WEBHOOK_SECRET_ENCRYPTION_KEY` exactly. Used to decrypt
   * `MerchantWebhookEndpoint.signingSecretCiphertext` at boot so the
   * scheduler can warm the Redis cache the delivery worker reads from.
   */
  WEBHOOK_SECRET_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/u, 'must be a 32-byte hex string (64 chars)'),
  WEBHOOK_DELIVERY_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),

  SUBSCRIPTION_SWEEPER_CRON: z.string().default('0 */15 * * * *'),
  INVOICE_OVERDUE_CRON: z.string().default('0 0 * * * *'),
  SUBSCRIPTION_SWEEP_LIMIT: z.coerce.number().int().min(1).max(10_000).default(100),
  SUBSCRIPTION_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),

  /**
   * Address of native USDC on the active Arc chain. Used by the gas-
   * balance monitor — Arc pays gas in USDC, so the relayer/scheduler
   * EOAs' USDC balance IS their gas runway.
   */
  ARC_USDC_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/u, 'must be a 0x-prefixed 20-byte hex address')
    .default('0x3600000000000000000000000000000000000000'),

  /**
   * Strimz API relayer EOA. Distinct from the scheduler's own signer —
   * it submits `Registry.registerMerchant` and the meta-tx payments
   * (`payWithAuthorization`). Monitored by the gas-balance cron so
   * either signer going dry triggers an alert.
   */
  RELAYER_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/u, 'must be a 0x-prefixed 20-byte hex address'),

  /**
   * Cron schedules for the two notification crons we own.
   *  - GAS_BALANCE_CRON: ops-facing, infrequent (every 15 min in prod).
   *  - MERCHANT_NOTIFICATION_CRON: merchant-facing, snappy (every 30 s)
   *    so a "you got paid" email lands in their inbox right after the
   *    payment confirms.
   */
  GAS_BALANCE_CRON: z.string().default('0 */15 * * * *'),
  GAS_BALANCE_THRESHOLD_USDC: z.coerce.number().positive().default(5),
  MERCHANT_NOTIFICATION_CRON: z.string().default('*/30 * * * * *'),
  MERCHANT_NOTIFICATION_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),

  /**
   * Where ops alerts (low gas, indexer lag, queue depth) are sent.
   * Distinct from RESEND_FROM_EMAIL — that's the sender; this is the
   * recipient for non-merchant alerts.
   */
  STRIMZ_ADMIN_ALERT_EMAIL: z.string().email(),

  RESEND_API_KEY: z.string().optional(),
  /**
   * Either a bare address (`noreply@mail.strimz.finance`) or RFC-5322
   * display form (`Strimz <noreply@mail.strimz.finance>`). We don't run
   * `.email()` here because the display form would fail validation;
   * Resend rejects malformed values at send time, which is the right
   * surface for that error anyway.
   */
  RESEND_FROM_EMAIL: z.string().min(1).default('Strimz <noreply@mail.strimz.finance>'),
  /**
   * Reply-To header. Defaults to the Strimz support mailbox so that
   * when a merchant hits Reply on a payment confirmation, the response
   * lands in a human inbox rather than bouncing off the noreply alias.
   */
  RESEND_REPLY_TO: z.string().email().default('strimztokenstream@gmail.com'),
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
