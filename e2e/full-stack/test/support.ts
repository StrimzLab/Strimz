import { createPrismaClient, type PrismaClient } from '@strimz/db'
import { StrimzClient } from '@strimz/sdk'
import { arcTestnet } from '@strimz/shared-config'
import { createPublicClient, erc20Abi, http, type Address } from 'viem'
import { inject } from 'vitest'
import { z } from 'zod'

export const apiUrl = inject('apiUrl')
export const deployment = inject('deployment')
export const merchant = inject('merchant')
export const actors = inject('actors')

export const strimz = new StrimzClient({ apiKey: merchant.secretKey, baseUrl: apiUrl })
export const chain = createPublicClient({ chain: arcTestnet, transport: http(deployment.rpcUrl) })

let prisma: PrismaClient | undefined
export function db(): PrismaClient {
  prisma ??= createPrismaClient({ databaseUrl: inject('databaseUrl') })
  return prisma
}

export function usdcBalance(who: Address): Promise<bigint> {
  return chain.readContract({
    address: deployment.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [who],
  })
}

export const submissionSchema = z.object({
  idempotencyKey: z.string(),
  status: z.enum(['queued', 'signing', 'broadcast', 'confirmed', 'reverted', 'failed']),
  txHash: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/u)
    .transform((h) => h as `0x${string}`)
    .nullable(),
})
export type Submission = z.infer<typeof submissionSchema>

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(`${status} ${code}: ${message}`)
  }
}

export async function publicPost(path: string, body: unknown): Promise<Submission> {
  const res = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json: unknown = await res.json()
  if (!res.ok) {
    const parsed = errorSchema.safeParse(json)
    if (!parsed.success) throw new Error(`${res.status} from ${path}: ${JSON.stringify(json)}`)
    throw new ApiError(res.status, parsed.data.error.code, parsed.data.error.message)
  }
  return submissionSchema.parse(json)
}

export async function publicGet<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
): Promise<z.output<S>> {
  const res = await fetch(`${apiUrl}${path}`)
  if (!res.ok) throw new Error(`${res.status} from GET ${path}: ${await res.text()}`)
  return schema.parse(await res.json())
}

export async function eventually<T>(
  what: string,
  read: () => Promise<T>,
  done: (value: T) => boolean,
  timeoutMs = 60_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let value = await read()
  while (!done(value)) {
    if (Date.now() > deadline) {
      throw new Error(
        `timed out waiting for ${what}; last value: ${JSON.stringify(value, bigintSafe)}`,
      )
    }
    await new Promise((r) => setTimeout(r, 500))
    value = await read()
  }
  return value
}

function bigintSafe(_key: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v
}

export const TERMINAL = new Set<Submission['status']>(['confirmed', 'reverted', 'failed'])
