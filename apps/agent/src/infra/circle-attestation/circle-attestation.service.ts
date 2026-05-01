import { Injectable } from '@nestjs/common'
import { TypedConfigService } from '../../config/index.js'

/**
 * Result of a single attestation fetch. `complete` means Circle has
 * signed the cross-chain message and `messageHex` / `attestationHex`
 * are ready to pass to the destination chain's `MessageTransmitter`.
 *
 * Anything else is "still in-flight" — the caller should poll again
 * after `pollIntervalMs`.
 */
export interface AttestationResult {
  status: 'pending_confirmations' | 'complete' | 'unknown'
  messageHex?: `0x${string}`
  attestationHex?: `0x${string}`
}

/**
 * Wraps Circle's CCTP V2 attestation API.
 *
 * Endpoints:
 *   testnet: https://iris-api-sandbox.circle.com
 *   mainnet: https://iris-api.circle.com
 *
 * Path:
 *   GET  /v2/messages/{sourceDomainId}?transactionHash={hash}
 *   200 → { messages: [{ message, attestation, status }] }
 *
 * The agent never holds Circle's API key for *write* operations
 * (Circle's API only requires a key for higher rate-limit tiers; the
 * core attestation lookup is open). When `CIRCLE_API_KEY` is set, we
 * include it; otherwise we use the unauthenticated path.
 */
@Injectable()
export class CircleAttestationService {
  private readonly baseUrl: string
  private readonly apiKey: string | undefined
  private readonly defaultTimeoutMs = 5_000

  constructor(cfg: TypedConfigService) {
    this.baseUrl = cfg.env.CIRCLE_ATTESTATION_BASE_URL
    this.apiKey = cfg.env.CIRCLE_API_KEY
  }

  /**
   * Returns the most recent message + attestation for a given
   * (source domain, source tx hash). If multiple messages were emitted
   * by the same tx (rare; happens when a contract burns multiple
   * tokens), the first complete one wins.
   *
   * Throws on transport-level errors (404/5xx); status='unknown'
   * indicates a 200 with no matching message.
   */
  async fetch(input: { sourceDomainId: number; sourceTxHash: string }): Promise<AttestationResult> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/v2/messages/${input.sourceDomainId}?transactionHash=${input.sourceTxHash}`
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.defaultTimeoutMs)
    try {
      const res = await fetch(url, { headers, signal: controller.signal })
      if (res.status === 404) {
        // Circle returns 404 while the source tx hasn't been seen by
        // the relayer yet. Treat as in-flight.
        return { status: 'pending_confirmations' }
      }
      if (!res.ok) {
        throw new Error(`circle attestation API ${res.status}: ${(await res.text()).slice(0, 500)}`)
      }
      const body = (await res.json()) as {
        messages?: Array<{
          message?: string
          attestation?: string
          status?: string
        }>
      }
      const messages = body.messages ?? []
      if (messages.length === 0) {
        return { status: 'unknown' }
      }
      const complete = messages.find((m) => m.status === 'complete' && m.message && m.attestation)
      if (complete) {
        return {
          status: 'complete',
          messageHex: this.coerceHex(complete.message!),
          attestationHex: this.coerceHex(complete.attestation!),
        }
      }
      // First non-complete message dictates the status string we surface.
      const first = messages[0]!
      return {
        status:
          first.status === 'pending_confirmations' ? 'pending_confirmations' : 'unknown',
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  /** Circle's API returns hex without the `0x` prefix sometimes. Normalise. */
  private coerceHex(s: string): `0x${string}` {
    return (s.startsWith('0x') ? s : `0x${s}`) as `0x${string}`
  }
}
