import { privateKeyToAccount } from 'viem/accounts'
import { z } from 'zod'
import { freshActor, fundUsdc } from '../src/chain.js'
import type { SeededMerchant } from '../src/seed.js'
import { apiUrl, deployment, submissionSchema, type Submission } from '../test/support.js'
import type { Signer } from '../test/flows.js'

const rateLimitedSchema = z.object({ error: z.object({ code: z.literal('rate_limited') }) })
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })

export const counters = { rateLimited: 0, rateLimitedWithoutRetryAfter: 0 }

export type RelayOutcome =
  | { ok: true; submission: Submission }
  | { ok: false; status: number; code: string; message: string }

// Waits out 429s the way a well-behaved client would, and counts them. Without a
// Retry-After header it backs off as @strimz/sdk does.
async function politeFetch(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init)
    if (res.status !== 429) return res
    const body: unknown = await res.json()
    if (!rateLimitedSchema.safeParse(body).success) {
      throw new Error(`429 without rate_limited from ${url}: ${JSON.stringify(body)}`)
    }
    counters.rateLimited++
    const retryAfter = Number(res.headers.get('retry-after'))
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      await sleep((retryAfter + 1) * 1000)
    } else {
      counters.rateLimitedWithoutRetryAfter++
      await sleep(Math.min(30_000, 500 * 2 ** attempt))
    }
  }
}

export async function merchantRelay(
  m: SeededMerchant,
  path: '/v1/relay/payments' | '/v1/relay/subscriptions',
  body: unknown,
): Promise<RelayOutcome> {
  const res = await politeFetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${m.secretKey}` },
    body: JSON.stringify(body),
  })
  const json: unknown = await res.json()
  if (res.ok) return { ok: true, submission: submissionSchema.parse(json) }
  const err = errorSchema.parse(json)
  return { ok: false, status: res.status, code: err.error.code, message: err.error.message }
}

export async function submission(m: SeededMerchant, key: string): Promise<Submission> {
  const res = await politeFetch(`${apiUrl}/v1/relay/submissions/${key}`, {
    headers: { authorization: `Bearer ${m.secretKey}` },
  })
  if (!res.ok) throw new Error(`${res.status} reading submission ${key}: ${await res.text()}`)
  return submissionSchema.parse(await res.json())
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export async function payers(count: number, wholeUsdc: bigint) {
  const list = Array.from({ length: count }, () => freshActor())
  for (const p of list) await fundUsdc(deployment.rpcUrl, p.address, wholeUsdc)
  return list.map((p) => privateKeyToAccount(p.privateKey))
}

export function signerFor(account: Signer['account'], m: SeededMerchant): Signer {
  return { account, onchainMerchantId: m.onchainMerchantId }
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0
}

export function intEnv(name: string, fallback: number, max: number): number {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new Error(`${name} must be an integer from 1 to ${max}, got ${raw}`)
  }
  return n
}

export function at<T>(list: readonly T[], i: number): T {
  const v = list[i]
  if (v === undefined) throw new Error(`no item at index ${i} of ${list.length}`)
  return v
}
