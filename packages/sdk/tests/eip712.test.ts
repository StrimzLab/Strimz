import { describe, expect, it } from 'vitest'

import {
  buildPermitTypedData,
  buildReceiveWithAuthorizationTypedData,
  PERMIT_TYPES,
  RECEIVE_WITH_AUTHORIZATION_TYPES,
} from '../src/eip712/index.js'

const TOKEN = '0x3600000000000000000000000000000000000000' as const
const PAYER = '0x4444444444444444444444444444444444444444' as const
const PAYMENTS_CONTRACT = '0x1111111111111111111111111111111111111111' as const
const SUBSCRIPTIONS_CONTRACT = '0x2222222222222222222222222222222222222222' as const

describe('buildReceiveWithAuthorizationTypedData', () => {
  it('produces the canonical EIP-3009 typed-data shape', () => {
    const typedData = buildReceiveWithAuthorizationTypedData({
      chainId: 5042002,
      token: TOKEN,
      tokenName: 'USD Coin',
      tokenVersion: '2',
      from: PAYER,
      to: PAYMENTS_CONTRACT,
      value: 100_000_000n,
      validAfter: 0n,
      validBefore: 1_800_000_000n,
      nonce: '0x1111111111111111111111111111111111111111111111111111111111111111',
    })

    expect(typedData.primaryType).toBe('ReceiveWithAuthorization')
    expect(typedData.domain).toEqual({
      name: 'USD Coin',
      version: '2',
      chainId: 5042002,
      verifyingContract: TOKEN,
    })
    expect(typedData.types).toBe(RECEIVE_WITH_AUTHORIZATION_TYPES)
    expect(typedData.message).toEqual({
      from: PAYER,
      to: PAYMENTS_CONTRACT,
      value: 100_000_000n,
      validAfter: 0n,
      validBefore: 1_800_000_000n,
      nonce: '0x1111111111111111111111111111111111111111111111111111111111111111',
    })
  })

  it('declares fields in the EXACT order the contract hashes', () => {
    // The order of the type fields is part of the EIP-712 typeHash —
    // shuffling them produces a different digest and the contract's
    // ecrecover will recover a different address. This is the most
    // common foot-gun for re-implementations.
    expect(RECEIVE_WITH_AUTHORIZATION_TYPES.ReceiveWithAuthorization).toEqual([
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ])
  })

  it('preserves bigint values without coercing to string or number', () => {
    const typedData = buildReceiveWithAuthorizationTypedData({
      chainId: 1,
      token: TOKEN,
      tokenName: 'X',
      tokenVersion: '1',
      from: PAYER,
      to: PAYMENTS_CONTRACT,
      value: (1n << 200n) + 7n, // a uint256 larger than Number.MAX_SAFE_INTEGER
      validAfter: 0n,
      validBefore: 1n,
      nonce: '0x' + '0'.repeat(64),
    })
    expect(typeof typedData.message.value).toBe('bigint')
    expect(typedData.message.value).toBe((1n << 200n) + 7n)
  })
})

describe('buildPermitTypedData', () => {
  it('produces the canonical EIP-2612 typed-data shape', () => {
    const typedData = buildPermitTypedData({
      chainId: 5042002,
      token: TOKEN,
      tokenName: 'USD Coin',
      tokenVersion: '2',
      owner: PAYER,
      spender: SUBSCRIPTIONS_CONTRACT,
      value: (1n << 256n) - 1n, // unlimited
      nonce: 0n,
      deadline: 1_800_000_000n,
    })

    expect(typedData.primaryType).toBe('Permit')
    expect(typedData.domain).toEqual({
      name: 'USD Coin',
      version: '2',
      chainId: 5042002,
      verifyingContract: TOKEN,
    })
    expect(typedData.types).toBe(PERMIT_TYPES)
    expect(typedData.message).toEqual({
      owner: PAYER,
      spender: SUBSCRIPTIONS_CONTRACT,
      value: (1n << 256n) - 1n,
      nonce: 0n,
      deadline: 1_800_000_000n,
    })
  })

  it('declares fields in the EXACT order EIP-2612 requires', () => {
    expect(PERMIT_TYPES.Permit).toEqual([
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ])
  })

  it('produces independent typed-data per call (no shared mutable state)', () => {
    const a = buildPermitTypedData({
      chainId: 1,
      token: TOKEN,
      tokenName: 'X',
      tokenVersion: '1',
      owner: PAYER,
      spender: SUBSCRIPTIONS_CONTRACT,
      value: 1n,
      nonce: 0n,
      deadline: 1n,
    })
    const b = buildPermitTypedData({
      chainId: 2,
      token: TOKEN,
      tokenName: 'Y',
      tokenVersion: '1',
      owner: PAYER,
      spender: SUBSCRIPTIONS_CONTRACT,
      value: 2n,
      nonce: 1n,
      deadline: 2n,
    })
    expect(a.domain.chainId).toBe(1)
    expect(b.domain.chainId).toBe(2)
    expect(a.message.value).toBe(1n)
    expect(b.message.value).toBe(2n)
    expect(a.types).toBe(b.types) // shared type definitions (immutable)
  })
})
