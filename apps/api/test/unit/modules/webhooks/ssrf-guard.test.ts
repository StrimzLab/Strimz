import type * as dnsPromises from 'node:dns/promises'
import { describe, it, expect, vi } from 'vitest'
import { isPrivateOrLoopback } from '../../../../src/modules/webhooks/ssrf-guard.js'

const dnsTable = vi.hoisted(() => new Map<string, Array<{ address: string; family: number }>>())

vi.mock('node:dns/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof dnsPromises>()
  return {
    ...actual,
    lookup: (hostname: string, options: { all: true }) => {
      const answer = dnsTable.get(hostname)
      if (answer) return Promise.resolve(answer)
      return actual.lookup(hostname, options)
    },
  }
})

const blocked = [
  '0.0.0.0',
  '0.255.255.255',
  '10.0.0.1',
  '10.255.255.255',
  '100.64.0.1',
  '100.127.255.255',
  '127.0.0.1',
  '127.255.255.254',
  '169.254.169.254',
  '172.16.0.1',
  '172.31.255.255',
  '192.0.0.1',
  '192.0.0.255',
  '192.0.2.1',
  '192.168.0.1',
  '192.168.255.255',
  '198.18.0.1',
  '198.19.255.255',
  '198.51.100.1',
  '203.0.113.1',
  '224.0.0.1',
  '239.255.255.255',
  '240.0.0.1',
  '255.255.255.255',
  '::',
  '::1',
  '::7f00:1',
  'fc00::1',
  'fd12:3456::1',
  'fe80::1',
  'febf::1',
  'ff02::1',
  'ff0e::1',
  '::ffff:127.0.0.1',
  '::ffff:7f00:1',
  '::ffff:10.0.0.1',
  '::ffff:169.254.169.254',
  '::ffff:198.18.0.1',
  '::ffff:192.168.1.1',
  '64:ff9b::7f00:1',
  '64:ff9b:1::1',
  '100::1',
  '2001:db8::1',
]

const allowed = [
  '1.1.1.1',
  '8.8.8.8',
  '9.255.255.255',
  '11.0.0.1',
  '100.63.255.255',
  '100.128.0.1',
  '126.255.255.255',
  '128.0.0.1',
  '169.253.255.255',
  '172.15.255.255',
  '172.32.0.1',
  '192.0.1.1',
  '192.167.255.255',
  '198.17.255.255',
  '198.20.0.1',
  '223.255.255.255',
  '2606:4700:4700::1111',
  '2001:4860:4860::8888',
  '::ffff:8.8.8.8',
]

describe('isPrivateOrLoopback', () => {
  it.each(blocked)('rejects the IP literal %s', async (address) => {
    await expect(isPrivateOrLoopback(address)).resolves.toBe(true)
  })

  it.each(blocked.filter((a) => a.includes(':')))(
    'rejects the bracketed IPv6 literal [%s]',
    async (address) => {
      await expect(isPrivateOrLoopback(`[${address}]`)).resolves.toBe(true)
    },
  )

  it.each(allowed)('accepts the IP literal %s', async (address) => {
    await expect(isPrivateOrLoopback(address)).resolves.toBe(false)
  })

  it.each(allowed.filter((a) => a.includes(':')))(
    'accepts the bracketed IPv6 literal [%s]',
    async (address) => {
      await expect(isPrivateOrLoopback(`[${address}]`)).resolves.toBe(false)
    },
  )

  it.each([
    ['loopback.merchant.example', '127.0.0.1', 4],
    ['metadata.merchant.example', '169.254.169.254', 4],
    ['bench.merchant.example', '198.18.0.10', 4],
    ['multicast.merchant.example', '224.0.0.251', 4],
    ['mapped.merchant.example', '::ffff:10.0.0.1', 6],
    ['ula.merchant.example', 'fd00::1', 6],
  ])('rejects %s resolving to %s', async (hostname, address, family) => {
    dnsTable.set(hostname, [{ address, family }])
    await expect(isPrivateOrLoopback(hostname)).resolves.toBe(true)
  })

  it('rejects a name when any one of its addresses is private', async () => {
    dnsTable.set('mixed.merchant.example', [
      { address: '93.184.216.34', family: 4 },
      { address: '198.18.0.1', family: 4 },
    ])
    await expect(isPrivateOrLoopback('mixed.merchant.example')).resolves.toBe(true)
  })

  it('accepts a name whose addresses are all public', async () => {
    dnsTable.set('public.merchant.example', [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ])
    await expect(isPrivateOrLoopback('public.merchant.example')).resolves.toBe(false)
  })
})
