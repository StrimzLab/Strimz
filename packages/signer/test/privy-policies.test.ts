import { describe, expect, it } from 'vitest'
import { parseAbiItem, toFunctionSelector, type AbiFunction } from 'viem'

import { signerFunctions, strimzSignerPolicies, type StrimzContracts } from '../src/index.js'

const contracts: StrimzContracts = {
  payments: '0x00000000000000000000000000000000000000a1',
  subscriptions: '0x00000000000000000000000000000000000000a2',
  registry: '0x00000000000000000000000000000000000000a3',
  usdc: '0x3600000000000000000000000000000000000000',
  eurc: '0x00000000000000000000000000000000000000a5',
}

type Condition = {
  field_source: string
  field: string
  operator: string
  value: unknown
  abi?: AbiFunction[]
}
type Rule = { method: string; action: string; conditions: Condition[] }

const allowed = (rules: Rule[]) =>
  rules.map((r) => {
    const to = r.conditions.find((c) => c.field === 'to')?.value
    const fn = r.conditions.find((c) => c.field === 'function_name')
    return `${String(to)} ${fn?.abi?.[0] ? toFunctionSelector(fn.abi[0]) : '?'}`
  })

const sel = (sig: string) => toFunctionSelector(parseAbiItem(`function ${sig}`) as AbiFunction)

// ADR-2026-11-22-privy-server-signers.
describe('Strimz signer policies', () => {
  const policies = strimzSignerPolicies(contracts)

  it('lets the relayer call only its own contract functions, with no value attached', () => {
    const rules = policies.relayer.rules as Rule[]
    expect(rules.every((r) => r.method === 'eth_signTransaction' && r.action === 'ALLOW')).toBe(
      true,
    )
    expect(allowed(rules).sort()).toEqual(
      [
        `${contracts.payments} ${sel('payWithAuthorization(uint256,address,(address,uint256,uint256,uint256,bytes32),bytes32,bytes,bytes)')}`,
        `${contracts.subscriptions} ${sel('permitAndCreateSubscription(uint256,address,uint256,uint32,uint64,uint64,bytes32,(address,uint256,uint256),bytes,bytes)')}`,
        `${contracts.subscriptions} ${sel('cancelWithSig(uint256,uint256,bytes)')}`,
        `${contracts.registry} ${sel('registerMerchant(address,address,uint16,uint16,uint256)')}`,
        `${contracts.usdc} ${sel('permit(address,address,uint256,uint256,bytes)')}`,
      ].sort(),
    )
    for (const r of rules) {
      expect(r.conditions).toContainEqual(
        expect.objectContaining({
          field_source: 'ethereum_transaction',
          field: 'value',
          operator: 'eq',
          value: '0x0',
        }),
      )
    }
  })

  it('lets the scheduler only charge, cancel and set fees', () => {
    expect(allowed(policies.scheduler.rules as Rule[]).sort()).toEqual(
      [
        `${contracts.subscriptions} ${sel('batchCharge(uint256[],bytes32[])')}`,
        `${contracts.subscriptions} ${sel('cancel(uint256)')}`,
        `${contracts.registry} ${sel('commitFeeBps(uint256)')}`,
        `${contracts.registry} ${sel('setFeeBps(uint256,uint16)')}`,
      ].sort(),
    )
  })

  it('lets the refund wallet send at most 5 USDC or EURC per transfer', () => {
    const rules = policies.refund.rules as Rule[]
    expect(allowed(rules).sort()).toEqual(
      [
        `${contracts.usdc} ${sel('transfer(address,uint256)')}`,
        `${contracts.eurc} ${sel('transfer(address,uint256)')}`,
      ].sort(),
    )
    for (const r of rules) {
      expect(r.conditions).toContainEqual(
        expect.objectContaining({
          field_source: 'ethereum_calldata',
          field: 'transfer.amount',
          operator: 'lte',
          value: '5000000',
        }),
      )
    }
  })

  it('exposes each signer function so the services can prove they match', () => {
    expect(signerFunctions.scheduler.map((f) => f.name).sort()).toEqual([
      'batchCharge',
      'cancel',
      'commitFeeBps',
      'setFeeBps',
    ])
  })
})
