import { describe, expect, it } from 'vitest'
import { erc20Abi, toFunctionSelector, type Abi, type AbiFunction } from 'viem'
import { signerFunctions } from '@strimz/signer'

import { StrimzRegistryAbi, StrimzSubscriptionsAbi } from '../../src/infra/chain/abis.js'

const selectorsOf = (abi: Abi, names: string[]) =>
  abi
    .filter((i): i is AbiFunction => i.type === 'function' && names.includes(i.name))
    .map((f) => toFunctionSelector(f))

const policySelectors = (fns: readonly AbiFunction[]) =>
  fns.map((f) => toFunctionSelector(f)).sort()

// ADR-2026-11-22-privy-server-signers: a call missing from the policy would be refused on mainnet.
describe('scheduler Privy policies', () => {
  it('allow exactly the scheduler calls on mainnet', () => {
    const sent = [
      ...selectorsOf(StrimzSubscriptionsAbi, ['batchCharge', 'cancel']),
      ...selectorsOf(StrimzRegistryAbi, ['commitFeeBps', 'setFeeBps']),
    ]
    expect(sent).toHaveLength(4)
    expect(policySelectors(signerFunctions.scheduler)).toEqual(sent.sort())
  })

  it('allow the refund wallet its token transfer', () => {
    expect(policySelectors(signerFunctions.refund)).toEqual(selectorsOf(erc20Abi, ['transfer']))
  })
})
