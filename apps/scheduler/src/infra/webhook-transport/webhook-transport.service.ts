import { Injectable } from '@nestjs/common'
import { lookup } from 'node:dns/promises'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { LookupFunction } from 'node:net'
import { resolveWebhookTarget, type ResolvedTarget } from './resolve-target.js'
import { WebhookTargetPolicy } from './webhook-target-policy.js'

const MAX_RESPONSE_CHARS = 4_000
const MAX_RESPONSE_BYTES = MAX_RESPONSE_CHARS * 4

export interface WebhookPostInit {
  headers: Record<string, string>
  body: string
  signal: AbortSignal
}

export interface WebhookResponse {
  status: number
  body: string
}

@Injectable()
export class WebhookTransport {
  constructor(private readonly policy: WebhookTargetPolicy) {}

  async post(url: string, init: WebhookPostInit): Promise<WebhookResponse> {
    const target = new URL(url)
    const send = senderFor(target.protocol)
    const port = target.port ? Number(target.port) : target.protocol === 'https:' ? 443 : 80
    const pinned = await resolveWebhookTarget(
      target.hostname,
      port,
      (hostname) => lookup(hostname, { all: true }),
      (address, p) => this.policy.permits(address, p),
    )
    init.signal.throwIfAborted()

    return new Promise<WebhookResponse>((resolve, reject) => {
      const req = send(
        target,
        {
          method: 'POST',
          headers: { ...init.headers, 'Content-Length': String(Buffer.byteLength(init.body)) },
          signal: init.signal,
          agent: false,
          lookup: pinnedLookup(pinned),
        },
        (res) => readCapped(res, resolve, reject),
      )
      req.on('error', reject)
      req.end(init.body)
    })
  }
}

function senderFor(protocol: string): typeof httpRequest {
  if (protocol === 'https:') return httpsRequest
  if (protocol === 'http:') return httpRequest
  throw new Error(`webhook url protocol ${protocol} is not supported`)
}

function pinnedLookup(target: ResolvedTarget): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address: target.address, family: target.family }])
    } else {
      callback(null, target.address, target.family)
    }
  }
}

function readCapped(
  res: IncomingMessage,
  resolve: (value: WebhookResponse) => void,
  reject: (reason: Error) => void,
): void {
  const status = res.statusCode
  if (status === undefined) {
    res.destroy()
    reject(new Error('webhook response carried no status code'))
    return
  }
  const chunks: Buffer[] = []
  let size = 0
  const finish = () =>
    resolve({ status, body: Buffer.concat(chunks).toString('utf8').slice(0, MAX_RESPONSE_CHARS) })
  res.on('data', (chunk: Buffer) => {
    chunks.push(chunk)
    size += chunk.length
    if (size >= MAX_RESPONSE_BYTES) {
      finish()
      res.destroy()
    }
  })
  res.on('end', finish)
  res.on('error', reject)
}
