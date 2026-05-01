import { StrimzClient } from '@strimz/sdk'
import { env } from './env'

/**
 * Server-side Strimz SDK client. Used in route handlers / server
 * components for read-only listing endpoints. Privy access tokens
 * authenticate against the `/v1/auth/*` paths; for resource paths
 * we attach the merchant's API key via the `Authorization` header.
 */
export function strimzServerClient(apiKey: string): StrimzClient {
  return new StrimzClient({ baseUrl: env.apiUrl, apiKey })
}
