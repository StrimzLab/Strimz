import { StrimzClient } from '@strimz/sdk'

/**
 * Server-side singleton `StrimzClient`. The secret key stays on the
 * Node process and never crosses the network boundary — every payment
 * session or subscription plan is minted here, then only its opaque id
 * is passed to the browser.
 *
 * A real production merchant would inject the secret via a secret
 * manager (Vercel env, AWS KMS, GCP Secret Manager). We keep it in a
 * `.env` file for the Arc-grant demo so the setup runbook stays
 * copy-paste-runnable.
 */

let cached: StrimzClient | null = null

export function getStrimzServerClient(): StrimzClient {
  if (cached) return cached
  const apiKey = process.env.STRIMZ_SECRET_KEY
  if (!apiKey) {
    throw new Error(
      'STRIMZ_SECRET_KEY is not set. Run `pnpm --filter @strimz/api seed:test-merchant` ' +
        'and paste the returned sk_live_... into apps/demo-merchant/.env.',
    )
  }
  cached = new StrimzClient({
    apiKey,
    baseUrl: process.env.STRIMZ_API_URL || 'http://localhost:4000',
  })
  return cached
}
