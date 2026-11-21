import { describe, expect, it, vi } from 'vitest'

import { GasBalanceMonitorService } from '../../src/crons/gas-balance-monitor/gas-balance-monitor.service.js'

const RELAYER = '0x00000000000000000000000000000000000000a1'
const SCHEDULER = '0x00000000000000000000000000000000000000b2'
const REFUND = '0x00000000000000000000000000000000000000e5'

function build(refundAddress: string | null) {
  const balances: Record<string, bigint> = {
    [RELAYER.toLowerCase()]: 100_000_000n,
    [SCHEDULER.toLowerCase()]: 100_000_000n,
    [REFUND.toLowerCase()]: 1_000_000n,
  }
  const read = vi.fn(({ args }: { args: [string] }) =>
    Promise.resolve(balances[args[0].toLowerCase()] ?? 0n),
  )
  const send = vi.fn().mockResolvedValue(undefined)
  const store = new Map<string, string>()
  const svc = new GasBalanceMonitorService(
    {
      env: {
        RELAYER_ADDRESS: RELAYER,
        ARC_USDC_ADDRESS: '0x3600000000000000000000000000000000000000',
        GAS_BALANCE_THRESHOLD_USDC: 5,
        ARC_ENVIRONMENT: 'testnet',
        STRIMZ_ADMIN_ALERT_EMAIL: 'ops@strimz.test',
      },
    } as never,
    { account: { address: SCHEDULER }, publicClient: { readContract: read } } as never,
    { send } as never,
    {
      client: {
        get: (k: string) => Promise.resolve(store.get(k) ?? null),
        set: (k: string, v: string) => Promise.resolve(void store.set(k, v)),
        del: (k: string) => Promise.resolve(store.delete(k)),
      },
    } as never,
    { address: refundAddress } as never,
  )
  return { svc, send }
}

// ADR-2026-11-21-free-plan-fee-integrity: on Arc the refund wallet pays gas in USDC too.
describe('gas balance monitor and the refund wallet', () => {
  it('watches the refund wallet and alerts when it is low', async () => {
    const { svc, send } = build(REFUND)

    expect(await svc.tickNow()).toEqual({ checked: 3, alerted: 1 })
    expect(send).toHaveBeenCalledOnce()
    expect((send.mock.calls[0]?.[0] as { subject: string }).subject).toContain('refund')
  })

  it('skips the refund wallet when none is configured', async () => {
    const { svc } = build(null)
    expect(await svc.tickNow()).toEqual({ checked: 2, alerted: 0 })
  })
})
