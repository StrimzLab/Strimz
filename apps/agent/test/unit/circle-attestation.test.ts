import { describe, it, expect } from 'vitest'
import { CircleAttestationService } from '../../src/infra/circle-attestation/circle-attestation.service.js'

/**
 * Pure-function tests against the Circle attestation client. We mock
 * `globalThis.fetch` to assert request shaping + parsing without
 * hitting Circle's real endpoint.
 */
function makeService(opts: { baseUrl?: string; apiKey?: string } = {}): CircleAttestationService {
  return new CircleAttestationService({
    env: {
      CIRCLE_ATTESTATION_BASE_URL: opts.baseUrl ?? 'https://iris.test',
      CIRCLE_API_KEY: opts.apiKey,
    },
  } as never)
}

describe('CircleAttestationService', () => {
  it('returns pending_confirmations on 404', async () => {
    const svc = makeService()
    const calls: string[] = []
    globalThis.fetch = (async (input: unknown) => {
      calls.push(String(input))
      return new Response('not found', { status: 404 })
    }) as never

    const r = await svc.fetch({ sourceDomainId: 6, sourceTxHash: '0xabc' })
    expect(r.status).toBe('pending_confirmations')
    expect(calls[0]).toContain('/v2/messages/6?transactionHash=0xabc')
  })

  it('returns complete with hex normalisation when Circle returns no 0x prefix', async () => {
    const svc = makeService()
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          messages: [
            {
              status: 'complete',
              message: 'beef',
              attestation: '0xcafe',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as never

    const r = await svc.fetch({ sourceDomainId: 0, sourceTxHash: '0xdead' })
    expect(r.status).toBe('complete')
    expect(r.messageHex).toBe('0xbeef')
    expect(r.attestationHex).toBe('0xcafe')
  })

  it('attaches Bearer token when CIRCLE_API_KEY is set', async () => {
    const svc = makeService({ apiKey: 'secret' })
    let captured: Record<string, string> | undefined
    globalThis.fetch = (async (_url: unknown, init?: { headers?: Record<string, string> }) => {
      captured = init?.headers
      return new Response(JSON.stringify({ messages: [] }), { status: 200 })
    }) as never

    await svc.fetch({ sourceDomainId: 0, sourceTxHash: '0xfeed' })
    expect(captured?.Authorization).toBe('Bearer secret')
  })

  it('throws on non-404 / non-2xx', async () => {
    const svc = makeService()
    globalThis.fetch = (async () => new Response('boom', { status: 500 })) as never
    await expect(svc.fetch({ sourceDomainId: 0, sourceTxHash: '0xfeed' })).rejects.toThrow(/500/)
  })
})
