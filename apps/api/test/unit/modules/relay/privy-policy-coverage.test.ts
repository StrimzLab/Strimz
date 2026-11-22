import { describe, expect, it } from 'vitest'
import { toFunctionSelector, type Abi, type AbiFunction } from 'viem'
import { signerFunctions } from '@strimz/signer'

import {
  cancelWithSigAbi,
  payWithAuthorizationAbi,
  permitAndCreateSubscriptionAbi,
} from '../../../../src/modules/relay/generated/contracts.js'
import { registerMerchantAbi } from '../../../../src/modules/merchants/registry.abi.js'
import { tokenPermitAbi } from '../../../../src/modules/relay/relay.service.js'

const selectorsOf = (abi: Abi, names: string[]) =>
  abi
    .filter((i): i is AbiFunction => i.type === 'function' && names.includes(i.name))
    .map((f) => toFunctionSelector(f))

// ADR-2026-11-22-privy-server-signers: a call missing from the policy would be refused on mainnet.
describe('relayer Privy policy', () => {
  it('allows exactly the calls the relay sends', () => {
    const sent = [
      ...selectorsOf(payWithAuthorizationAbi, ['payWithAuthorization']),
      ...selectorsOf(permitAndCreateSubscriptionAbi, ['permitAndCreateSubscription']),
      ...selectorsOf(cancelWithSigAbi, ['cancelWithSig']),
      ...selectorsOf(registerMerchantAbi, ['registerMerchant']),
      ...selectorsOf(tokenPermitAbi, ['permit']),
    ]
    expect(sent).toHaveLength(5)
    expect(signerFunctions.relayer.map((f) => toFunctionSelector(f)).sort()).toEqual(sent.sort())
  })
})
