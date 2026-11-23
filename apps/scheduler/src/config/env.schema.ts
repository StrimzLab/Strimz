import { privateKeyToAccount } from 'viem/accounts'
import { z } from 'zod'

import { parseFallbackRpcUrls } from './rpc-fallbacks.js'

const unsetWhenEmpty = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional())

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

  ARC_ENVIRONMENT: z.enum(['testnet', 'mainnet']).optional(),
  ARC_RPC_URL: z.string().url(),
  // Tried in order when ARC_RPC_URL fails (ADR-2026-11-22-rpc-per-service).
  ARC_FALLBACK_RPC_URLS: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      try {
        return parseFallbackRpcUrls(raw)
      } catch (err) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: (err as Error).message })
        return z.NEVER
      }
    }),

  // Plain key. Production allows it only on testnet (ADR-2026-11-13-testnet-software-signer).
  SCHEDULER_PRIVATE_KEY: unsetWhenEmpty(
    z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 0x-prefixed 32-byte hex private key'),
  ),
  SCHEDULER_SIGNER_PROVIDER: z.enum(['software', 'aws-kms', 'privy']).default('software'),
  SCHEDULER_KMS_KEY_ID: unsetWhenEmpty(z.string()),
  SCHEDULER_SIGNER_ADDRESS: unsetWhenEmpty(
    z.string().regex(/^0x[0-9a-fA-F]{40}$/u, 'must be a 0x-prefixed 20-byte hex address'),
  ),
  AWS_REGION: unsetWhenEmpty(z.string()),

  // The wallet that pays free-allowance fee refunds (ADR-2026-11-21-free-plan-fee-integrity).
  // It holds no contract roles; ops keep a small float in it.
  REFUND_SIGNER_PROVIDER: unsetWhenEmpty(z.enum(['software', 'aws-kms', 'privy'])),
  REFUND_PRIVATE_KEY: unsetWhenEmpty(
    z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 0x-prefixed 32-byte hex private key'),
  ),
  REFUND_KMS_KEY_ID: unsetWhenEmpty(z.string()),
  REFUND_SIGNER_ADDRESS: unsetWhenEmpty(
    z.string().regex(/^0x[0-9a-fA-F]{40}$/u, 'must be a 0x-prefixed 20-byte hex address'),
  ),

  // Mainnet signers are Privy server wallets (ADR-2026-11-22-privy-server-signers).
  PRIVY_APP_ID: unsetWhenEmpty(z.string()),
  PRIVY_APP_SECRET: unsetWhenEmpty(z.string()),
  // The server's Privy authorization key. It can only sign what each wallet's policy allows.
  PRIVY_SIGNER_AUTHORIZATION_KEY: unsetWhenEmpty(z.string()),
  PRIVY_SCHEDULER_WALLET_ID: unsetWhenEmpty(z.string()),
  PRIVY_REFUND_WALLET_ID: unsetWhenEmpty(z.string()),

  SUBSCRIPTIONS_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed 20-byte hex address'),
  // Unset on mainnet, which launches without the agent contracts (ADR-2026-11-23).
  AGENT_ESCROW_ADDRESS: unsetWhenEmpty(
    z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed 20-byte hex address'),
  ),
  REGISTRY_ADDRESS: z
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
  PLAN_UPGRADE_CRON: z.string().default('0 */5 * * * *'),
  CONTRACT_ALERT_CRON: z.string().default('0 * * * * *'),
  FEE_DRIFT_CRON: z.string().default('0 */5 * * * *'),
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
  /** Hosted checkout origin. Payer links (allowance renewal) point here. */
  CHECKOUT_ORIGIN: z.string().url(),

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
  RESEND_REPLY_TO: z.string().email().default('support@strimz.finance'),

  /** Gates payer-side renewal receipts only. Off keeps us under the Resend free-tier ceiling. */
  // Not z.coerce.boolean(): Boolean("false") is true, so an explicit
  // SEND_PAYER_CHARGE_RECEIPTS=false would enable the flag.
  SEND_PAYER_CHARGE_RECEIPTS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Resend free plan caps at 100/day; we default to 90 for headroom. */
  DAILY_EMAIL_BUDGET: z.coerce.number().int().positive().default(90),
})

type ParsedEnv = z.infer<typeof envSchema>

function issue(ctx: z.RefinementCtx, path: keyof ParsedEnv, message: string) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
}

function schedulerSignerAddress(env: ParsedEnv): string | undefined {
  if (env.SCHEDULER_SIGNER_PROVIDER !== 'software') return env.SCHEDULER_SIGNER_ADDRESS
  if (!env.SCHEDULER_PRIVATE_KEY) return undefined
  return privateKeyToAccount(env.SCHEDULER_PRIVATE_KEY as `0x${string}`).address
}

function refundSignerAddress(env: ParsedEnv): string | undefined {
  if (env.REFUND_SIGNER_PROVIDER === 'aws-kms' || env.REFUND_SIGNER_PROVIDER === 'privy') {
    return env.REFUND_SIGNER_ADDRESS
  }
  if (env.REFUND_SIGNER_PROVIDER !== 'software' || !env.REFUND_PRIVATE_KEY) return undefined
  return privateKeyToAccount(env.REFUND_PRIVATE_KEY as `0x${string}`).address
}

const separatedSignersSchema = envSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && !env.ARC_ENVIRONMENT) {
    issue(ctx, 'ARC_ENVIRONMENT', 'required when NODE_ENV=production')
  }

  const onMainnet = env.NODE_ENV === 'production' && env.ARC_ENVIRONMENT === 'mainnet'
  if (onMainnet && env.SCHEDULER_SIGNER_PROVIDER !== 'privy') {
    issue(ctx, 'SCHEDULER_SIGNER_PROVIDER', 'must be privy in production on mainnet')
  }
  if (env.SCHEDULER_SIGNER_PROVIDER === 'software') {
    if (env.NODE_ENV === 'production' && env.ARC_ENVIRONMENT !== 'testnet') {
      issue(
        ctx,
        'SCHEDULER_SIGNER_PROVIDER',
        'software keeps the scheduler key in process memory and is refused in production on mainnet; set privy',
      )
    }
    if (!env.SCHEDULER_PRIVATE_KEY) {
      issue(ctx, 'SCHEDULER_PRIVATE_KEY', 'required when SCHEDULER_SIGNER_PROVIDER=software')
    }
  } else {
    const provider = env.SCHEDULER_SIGNER_PROVIDER
    const needed =
      provider === 'privy'
        ? (['PRIVY_SCHEDULER_WALLET_ID', 'SCHEDULER_SIGNER_ADDRESS'] as const)
        : (['SCHEDULER_KMS_KEY_ID', 'SCHEDULER_SIGNER_ADDRESS', 'AWS_REGION'] as const)
    for (const key of needed) {
      if (!env[key]) issue(ctx, key, `required when SCHEDULER_SIGNER_PROVIDER=${provider}`)
    }
    if (env.SCHEDULER_PRIVATE_KEY) {
      issue(
        ctx,
        'SCHEDULER_PRIVATE_KEY',
        `must be unset when SCHEDULER_SIGNER_PROVIDER=${provider}; remove the plaintext key`,
      )
    }
  }

  if (env.NODE_ENV === 'production' && !env.REFUND_SIGNER_PROVIDER) {
    issue(
      ctx,
      'REFUND_SIGNER_PROVIDER',
      'required when NODE_ENV=production: merchants are owed fee refunds',
    )
  }
  if (onMainnet && env.REFUND_SIGNER_PROVIDER && env.REFUND_SIGNER_PROVIDER !== 'privy') {
    issue(ctx, 'REFUND_SIGNER_PROVIDER', 'must be privy in production on mainnet')
  }
  if (env.REFUND_SIGNER_PROVIDER === 'software') {
    if (!env.REFUND_PRIVATE_KEY) {
      issue(ctx, 'REFUND_PRIVATE_KEY', 'required when REFUND_SIGNER_PROVIDER=software')
    }
  } else if (env.REFUND_SIGNER_PROVIDER === 'aws-kms') {
    for (const key of ['REFUND_KMS_KEY_ID', 'REFUND_SIGNER_ADDRESS', 'AWS_REGION'] as const) {
      if (!env[key]) issue(ctx, key, 'required when REFUND_SIGNER_PROVIDER=aws-kms')
    }
    if (env.REFUND_PRIVATE_KEY) {
      issue(ctx, 'REFUND_PRIVATE_KEY', 'must be unset when REFUND_SIGNER_PROVIDER=aws-kms')
    }
  } else if (env.REFUND_SIGNER_PROVIDER === 'privy') {
    for (const key of ['PRIVY_REFUND_WALLET_ID', 'REFUND_SIGNER_ADDRESS'] as const) {
      if (!env[key]) issue(ctx, key, 'required when REFUND_SIGNER_PROVIDER=privy')
    }
    if (env.REFUND_PRIVATE_KEY) {
      issue(ctx, 'REFUND_PRIVATE_KEY', 'must be unset when REFUND_SIGNER_PROVIDER=privy')
    }
  }
  if (env.SCHEDULER_SIGNER_PROVIDER === 'privy' || env.REFUND_SIGNER_PROVIDER === 'privy') {
    for (const key of [
      'PRIVY_APP_ID',
      'PRIVY_APP_SECRET',
      'PRIVY_SIGNER_AUTHORIZATION_KEY',
    ] as const) {
      if (!env[key]) issue(ctx, key, 'required for a privy signer')
    }
  }

  const schedulerAddress = schedulerSignerAddress(env)
  const refundAddress = refundSignerAddress(env)
  if (
    refundAddress &&
    (refundAddress.toLowerCase() === schedulerAddress?.toLowerCase() ||
      refundAddress.toLowerCase() === env.RELAYER_ADDRESS.toLowerCase())
  ) {
    issue(
      ctx,
      'REFUND_SIGNER_PROVIDER',
      'the refund wallet must be its own key, not the scheduler or the relayer',
    )
  }
  if (schedulerAddress?.toLowerCase() === env.RELAYER_ADDRESS.toLowerCase()) {
    issue(
      ctx,
      'RELAYER_ADDRESS',
      "must not be the scheduler's signing address; the scheduler and the API relayer need separate keys",
    )
  }
})

/**
 * `validate` is the function `@nestjs/config` calls; it must throw when
 * validation fails. Returns the parsed object so `.get` reads typed values.
 */
const validatedEnvSchema = separatedSignersSchema.transform((env) => ({
  ...env,
  ARC_ENVIRONMENT: env.ARC_ENVIRONMENT ?? 'testnet',
}))

export type Env = z.output<typeof validatedEnvSchema>

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = validatedEnvSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  return parsed.data
}
