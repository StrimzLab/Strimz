import { describe, expect, it } from 'vitest'
import {
  encodeFunctionData,
  getAddress,
  keccak256,
  parseAbi,
  toHex,
  zeroHash,
  type Address,
} from 'viem'

import {
  describeSafeCall,
  safeConsoleAbis,
  safeTxHashOf,
  safeTxTypedData,
  typedDataJson,
  UnrecognisedSafeCallError,
  type SafeKnownAddresses,
} from '../safe-console'

const a = (n: number) => getAddress(`0x${n.toString(16).padStart(40, '0')}`) as Address
const known: SafeKnownAddresses = {
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
}
const role = (name: string) => keccak256(toHex(`STRIMZ_${name}`))
const roleCall = (fn: 'grantRole' | 'revokeRole', name: string, who: Address) =>
  encodeFunctionData({
    abi: safeConsoleAbis.accessControl,
    functionName: fn,
    args: [role(name), who],
  })

describe('safe console typed data', () => {
  it('hashes a Safe transaction the way the Safe contract does', () => {
    // Same reference as apps/api: the testnet Safe's own getTransactionHash.
    const hash = safeTxHashOf(5042002, '0xe38788afb172c1a7bb01feec5db0e3b21df301d7', {
      to: a(0xa1),
      data: '0x8456cb59',
      nonce: 7,
    })
    expect(hash).toBe('0x2c7d7187370b99a388818adac9ca585b68823e533bef81a2f61af8e87fd6e50c')
  })

  it('serialises for eth_signTypedData_v4 with the EIP712Domain type', () => {
    const json = JSON.parse(
      typedDataJson(safeTxTypedData(5042002, known.safe, { to: a(1), data: '0x', nonce: 3 })),
    ) as { types: Record<string, unknown>; message: { nonce: string; gasPrice: string } }
    expect(Object.keys(json.types)).toEqual(['EIP712Domain', 'SafeTx'])
    expect(json.message).toMatchObject({ nonce: '3', gasPrice: '0' })
  })
})

describe('describeSafeCall', () => {
  it('reads pause and unpause', () => {
    const pause = encodeFunctionData({ abi: safeConsoleAbis.pausable, functionName: 'pause' })
    expect(describeSafeCall(known, { to: known.contracts.payments, data: pause }).title).toBe(
      'Pause Payments',
    )
    const unpause = encodeFunctionData({ abi: safeConsoleAbis.pausable, functionName: 'unpause' })
    expect(
      describeSafeCall(known, { to: known.contracts.subscriptions, data: unpause }).title,
    ).toBe('Unpause Subscriptions')
  })

  it('reads a fee withdrawal in whole tokens', () => {
    const data = encodeFunctionData({
      abi: safeConsoleAbis.feeCollector,
      functionName: 'withdraw',
      args: [known.tokens.USDC, a(0xee), 1_500_000n],
    })
    expect(describeSafeCall(known, { to: known.contracts.feeCollector, data })).toEqual({
      title: 'Withdraw fees',
      lines: ['1.5 USDC', `To ${a(0xee)}`],
    })
  })

  it('reads a direct role change', () => {
    const data = roleCall('grantRole', 'MERCHANT_REGISTRAR_ROLE', a(0xc1))
    expect(describeSafeCall(known, { to: known.contracts.registry, data })).toEqual({
      title: 'Change a role now',
      lines: [`Grant MERCHANT_REGISTRAR_ROLE to ${a(0xc1)} on Registry`],
    })
  })

  it('reads a scheduled role change with its delay', () => {
    const inner = roleCall('revokeRole', 'PAUSER_ROLE', a(0xc2))
    const data = encodeFunctionData({
      abi: safeConsoleAbis.timelock,
      functionName: 'schedule',
      args: [known.contracts.payments, 0n, inner, zeroHash, zeroHash, 172_800n],
    })
    expect(describeSafeCall(known, { to: known.timelock, data })).toEqual({
      title: 'Schedule a role change (runs after 48 hours)',
      lines: [`Revoke PAUSER_ROLE from ${a(0xc2)} on Payments`],
    })
  })

  it('reads owner changes', () => {
    const data = encodeFunctionData({
      abi: safeConsoleAbis.safe,
      functionName: 'swapOwner',
      args: [a(1), a(0xb1), a(0xb9)],
    })
    expect(describeSafeCall(known, { to: known.safe, data })).toEqual({
      title: 'Replace a Safe owner',
      lines: [`Remove ${a(0xb1)}`, `Add ${a(0xb9)}`],
    })
  })

  it.each([
    [
      'an unknown contract',
      a(0x99),
      encodeFunctionData({ abi: safeConsoleAbis.pausable, functionName: 'pause' }),
    ],
    [
      'a function outside the menu',
      a(0xa1),
      encodeFunctionData({
        abi: parseAbi(['function upgradeToAndCall(address, bytes)']),
        args: [a(1), '0x'],
      }),
    ],
    [
      'a schedule aimed at an unknown contract',
      a(0x71),
      encodeFunctionData({
        abi: safeConsoleAbis.timelock,
        functionName: 'schedule',
        args: [a(0x99), 0n, roleCall('grantRole', 'ADMIN_ROLE', a(1)), zeroHash, zeroHash, 1n],
      }),
    ],
    [
      'a schedule that sends value',
      a(0x71),
      encodeFunctionData({
        abi: safeConsoleAbis.timelock,
        functionName: 'schedule',
        args: [a(0xa1), 1n, roleCall('grantRole', 'ADMIN_ROLE', a(1)), zeroHash, zeroHash, 1n],
      }),
    ],
    [
      'an unknown role',
      a(0xa3),
      encodeFunctionData({
        abi: safeConsoleAbis.accessControl,
        functionName: 'grantRole',
        args: [zeroHash, a(1)],
      }),
    ],
  ] as const)('refuses %s', (_label, to, data) => {
    expect(() => describeSafeCall(known, { to, data })).toThrow(UnrecognisedSafeCallError)
  })
})
