import { describe, it, expect } from 'vitest'
import { isBlockedAddress } from '../../src/infra/webhook-transport/blocked-addresses.js'
import {
  BlockedWebhookTargetError,
  resolveWebhookTarget,
  type LookupAll,
} from '../../src/infra/webhook-transport/resolve-target.js'

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
  'fe80::1%lo0',
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

describe('isBlockedAddress', () => {
  it.each(blocked)('blocks %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true)
  })

  it.each(allowed)('allows %s', (address) => {
    expect(isBlockedAddress(address)).toBe(false)
  })

  it('throws on input that is not an IP address', () => {
    expect(() => isBlockedAddress('example.com')).toThrow(/not an IP address/)
  })
})

function lookupReturning(
  table: Record<string, Array<{ address: string; family: number }>>,
): LookupAll & { calls: string[] } {
  const calls: string[] = []
  const fn = (hostname: string) => {
    calls.push(hostname)
    const answer = table[hostname]
    if (!answer) return Promise.reject(new Error(`ENOTFOUND ${hostname}`))
    return Promise.resolve(answer)
  }
  return Object.assign(fn, { calls })
}

const realPolicy = (address: string) => !isBlockedAddress(address)

describe('resolveWebhookTarget', () => {
  it('returns the first resolved address when every address is public', async () => {
    const lookup = lookupReturning({
      'hooks.merchant.example': [
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      ],
    })
    await expect(
      resolveWebhookTarget('hooks.merchant.example', 443, lookup, realPolicy),
    ).resolves.toEqual({ address: '93.184.216.34', family: 4 })
  })

  it('refuses a name that resolves to loopback', async () => {
    const lookup = lookupReturning({ 'evil.example': [{ address: '127.0.0.1', family: 4 }] })
    await expect(resolveWebhookTarget('evil.example', 443, lookup, realPolicy)).rejects.toThrow(
      BlockedWebhookTargetError,
    )
  })

  it('refuses a name when any one of its addresses is private', async () => {
    const lookup = lookupReturning({
      'mixed.example': [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.5', family: 4 },
      ],
    })
    await expect(resolveWebhookTarget('mixed.example', 443, lookup, realPolicy)).rejects.toThrow(
      /mixed\.example resolves to blocked address 10\.0\.0\.5/,
    )
  })

  it('refuses a name that resolves to an IPv4-mapped IPv6 private address', async () => {
    const lookup = lookupReturning({
      'mapped.example': [{ address: '::ffff:169.254.169.254', family: 6 }],
    })
    await expect(resolveWebhookTarget('mapped.example', 443, lookup, realPolicy)).rejects.toThrow(
      BlockedWebhookTargetError,
    )
  })

  it('refuses a name that resolves to the 198.18.0.0/15 benchmark range', async () => {
    const lookup = lookupReturning({ 'bench.example': [{ address: '198.18.4.2', family: 4 }] })
    await expect(resolveWebhookTarget('bench.example', 443, lookup, realPolicy)).rejects.toThrow(
      BlockedWebhookTargetError,
    )
  })

  it('checks an IP literal directly without a DNS lookup', async () => {
    const lookup = lookupReturning({})
    await expect(resolveWebhookTarget('169.254.169.254', 80, lookup, realPolicy)).rejects.toThrow(
      BlockedWebhookTargetError,
    )
    await expect(resolveWebhookTarget('[::ffff:7f00:1]', 80, lookup, realPolicy)).rejects.toThrow(
      BlockedWebhookTargetError,
    )
    await expect(resolveWebhookTarget('8.8.8.8', 443, lookup, realPolicy)).resolves.toEqual({
      address: '8.8.8.8',
      family: 4,
    })
    await expect(
      resolveWebhookTarget('[2606:4700:4700::1111]', 443, lookup, realPolicy),
    ).resolves.toEqual({ address: '2606:4700:4700::1111', family: 6 })
    expect(lookup.calls).toEqual([])
  })

  it('refuses a name that resolves to no addresses', async () => {
    const lookup = lookupReturning({ 'empty.example': [] })
    await expect(resolveWebhookTarget('empty.example', 443, lookup, realPolicy)).rejects.toThrow(
      /empty\.example resolved to no addresses/,
    )
  })

  it('propagates a DNS failure', async () => {
    const lookup = lookupReturning({})
    await expect(resolveWebhookTarget('missing.example', 443, lookup, realPolicy)).rejects.toThrow(
      /ENOTFOUND missing\.example/,
    )
  })

  it('passes the port to the policy', async () => {
    const lookup = lookupReturning({ 'local.example': [{ address: '127.0.0.1', family: 4 }] })
    const seen: Array<[string, number]> = []
    const policy = (address: string, port: number) => {
      seen.push([address, port])
      return port === 8443
    }
    await expect(resolveWebhookTarget('local.example', 8443, lookup, policy)).resolves.toEqual({
      address: '127.0.0.1',
      family: 4,
    })
    expect(seen).toEqual([['127.0.0.1', 8443]])
  })
})
