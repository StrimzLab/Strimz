import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

const NGINX_CONF = fileURLToPath(
  new URL('../../../../../infra/lightsail/nginx.conf', import.meta.url),
)

async function clientIp(remoteAddress: string, forwardedFor: string): Promise<string> {
  const { TRUSTED_PROXIES } = await import('../../../src/common/http/trust-proxy.js')
  const app = Fastify({ trustProxy: TRUSTED_PROXIES })
  app.get('/ip', (req) => ({ ip: req.ip }))
  try {
    const res = await app.inject({
      method: 'GET',
      url: '/ip',
      remoteAddress,
      headers: { 'x-forwarded-for': forwardedFor },
    })
    return (res.json() as { ip: string }).ip
  } finally {
    await app.close()
  }
}

describe('trusted proxies', () => {
  it('takes the address nginx forwards, not one the client wrote first', async () => {
    expect(await clientIp('127.0.0.1', '6.6.6.6, 198.51.100.7')).toBe('198.51.100.7')
  })

  it('ignores X-Forwarded-For from a peer that is not the local nginx', async () => {
    expect(await clientIp('203.0.113.5', '6.6.6.6')).toBe('203.0.113.5')
  })
})

describe('container nginx', () => {
  const conf = readFileSync(NGINX_CONF, 'utf8')

  it('resolves the client address from the host proxy hop with the realip module', () => {
    expect(conf).toMatch(/^\s*set_real_ip_from\s+\S+;/mu)
    expect(conf).toMatch(/^\s*real_ip_header\s+X-Forwarded-For;/mu)
    expect(conf).not.toMatch(/^\s*real_ip_recursive\s+on;/mu)
  })

  it('forwards a single client address instead of appending to the client header', () => {
    expect(conf).toMatch(/proxy_set_header\s+X-Forwarded-For\s+\$remote_addr;/u)
    expect(conf).not.toContain('$proxy_add_x_forwarded_for')
  })
})
