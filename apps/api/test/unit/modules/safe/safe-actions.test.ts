import { describe, expect, it } from 'vitest'
import { decodeFunctionData, getAddress, keccak256, toHex, type Address } from 'viem'

import {
  buildSafeCall,
  safeActionSchema,
  timelockOperationId,
  type SafeContext,
} from '../../../../src/modules/safe/safe-actions.js'
import { safeAbis } from '../../../../src/modules/safe/safe-abi.js'

const a = (n: number) => getAddress(`0x${n.toString(16).padStart(40, '0')}`) as Address
const ctx: SafeContext = {
  safe: a(0x5a),
  timelock: a(0x71),
  contracts: {
    registry: a(0xa3),
    payments: a(0xa1),
    subscriptions: a(0xa2),
    feeCollector: a(0xa4),
    tokenWhitelist: a(0xa5),
  },
  tokens: { USDC: a(0x36), EURC: a(0x37) },
  owners: [a(0xb1), a(0xb2), a(0xb3)],
  threshold: 2,
  timelockDelay: 172_800n,
}
const SALT = `0x${'cd'.repeat(32)}` as const
const role = (name: string) => keccak256(toHex(name))

describe('buildSafeCall', () => {
  it('pauses and unpauses directly from the Safe', () => {
    const pause = buildSafeCall({ kind: 'pause', contract: 'payments' }, ctx, SALT)
    expect(pause.call).toMatchObject({ to: ctx.contracts.payments, value: 0n, operation: 0 })
    expect(decodeFunctionData({ abi: safeAbis.pausable, data: pause.call.data }).functionName).toBe(
      'pause',
    )
    const unpause = buildSafeCall({ kind: 'unpause', contract: 'subscriptions' }, ctx, SALT)
    expect(unpause.call.to).toBe(ctx.contracts.subscriptions)
    expect(unpause.timelock).toBeUndefined()
  })

  it('withdraws fees to the given address', () => {
    const built = buildSafeCall(
      { kind: 'withdrawFees', token: 'USDC', to: a(0xee), amount: '1500000' },
      ctx,
      SALT,
    )
    expect(built.call.to).toBe(ctx.contracts.feeCollector)
    expect(decodeFunctionData({ abi: safeAbis.feeCollector, data: built.call.data }).args).toEqual([
      ctx.tokens.USDC,
      a(0xee),
      1_500_000n,
    ])
  })

  it('grants an operational role directly', () => {
    const built = buildSafeCall(
      {
        kind: 'grantRole',
        contract: 'registry',
        role: 'MERCHANT_REGISTRAR_ROLE',
        account: a(0xc1),
      },
      ctx,
      SALT,
    )
    expect(built.call.to).toBe(ctx.contracts.registry)
    expect(built.timelock).toBeUndefined()
    expect(decodeFunctionData({ abi: safeAbis.accessControl, data: built.call.data }).args).toEqual(
      [role('STRIMZ_MERCHANT_REGISTRAR_ROLE'), a(0xc1)],
    )
  })

  it('schedules any other role change through the Timelock', () => {
    const built = buildSafeCall(
      { kind: 'revokeRole', contract: 'payments', role: 'PAUSER_ROLE', account: a(0xc2) },
      ctx,
      SALT,
    )
    expect(built.call.to).toBe(ctx.timelock)
    const scheduled = decodeFunctionData({ abi: safeAbis.timelock, data: built.call.data })
    expect(scheduled.functionName).toBe('schedule')
    expect(scheduled.args?.[0]).toBe(ctx.contracts.payments)
    expect(scheduled.args?.[4]).toBe(SALT)
    expect(scheduled.args?.[5]).toBe(ctx.timelockDelay)
    expect(built.timelock?.target).toBe(ctx.contracts.payments)
  })

  it('removes an owner with the owner before it in the Safe list', () => {
    const built = buildSafeCall({ kind: 'removeOwner', owner: a(0xb2), threshold: 2 }, ctx, SALT)
    expect(built.call.to).toBe(ctx.safe)
    expect(decodeFunctionData({ abi: safeAbis.safe, data: built.call.data }).args).toEqual([
      a(0xb1),
      a(0xb2),
      2n,
    ])
    const first = buildSafeCall({ kind: 'removeOwner', owner: a(0xb1), threshold: 2 }, ctx, SALT)
    expect(decodeFunctionData({ abi: safeAbis.safe, data: first.call.data }).args?.[0]).toBe(
      '0x0000000000000000000000000000000000000001',
    )
  })

  it.each([
    [{ kind: 'changeThreshold', threshold: 1 }, /at least 2/u],
    [{ kind: 'changeThreshold', threshold: 4 }, /more than the 3 owners/u],
    [{ kind: 'removeOwner', owner: a(0xb2), threshold: 3 }, /more than the 2 owners/u],
    [{ kind: 'removeOwner', owner: a(0xff), threshold: 2 }, /not an owner/u],
    [{ kind: 'addOwner', owner: a(0xb1), threshold: 2 }, /already an owner/u],
    [{ kind: 'swapOwner', oldOwner: a(0xb1), newOwner: a(0xb2) }, /already an owner/u],
  ] as const)('refuses %j', (action, message) => {
    expect(() => buildSafeCall(safeActionSchema.parse(action), ctx, SALT)).toThrow(message)
  })

  it('refuses the zero address as a recipient or account', () => {
    expect(() =>
      safeActionSchema.parse({
        kind: 'withdrawFees',
        token: 'USDC',
        to: '0x0000000000000000000000000000000000000000',
        amount: '1',
      }),
    ).toThrow()
  })

  it('accepts only the listed actions', () => {
    expect(() => safeActionSchema.parse({ kind: 'call', to: a(1), data: '0x' })).toThrow()
    expect(() => safeActionSchema.parse({ kind: 'pause', contract: 'registry' })).toThrow()
  })

  it('names a Timelock operation the way the Timelock does', () => {
    // From the testnet TimelockController's own hashOperation.
    expect(timelockOperationId(a(0xa1), '0x8456cb59', SALT)).toBe(
      '0x4654e84c8b01811f6afd0291f0cdcb863c2d7799879e883544db814d7f340908',
    )
  })
})
