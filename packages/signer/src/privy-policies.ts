import { parseAbiItem, type AbiFunction, type Address } from 'viem'

export interface StrimzContracts {
  payments: Address
  subscriptions: Address
  registry: Address
  usdc: Address
  eurc: Address
  safe: Address
}

const fn = (signature: string) => parseAbiItem(`function ${signature}`) as AbiFunction

/** Every call each signer makes. The services' tests check their real ABIs against these. */
export const signerFunctions = {
  relayer: [
    fn(
      'payWithAuthorization(uint256 merchantId, address token, (address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce) auth, bytes32 sessionId, bytes authSignature, bytes intentSignature)',
    ),
    fn(
      'permitAndCreateSubscription(uint256 merchantId, address token, uint256 amount, uint32 interval, uint64 startAt, uint64 endAt, bytes32 intentId, (address owner, uint256 value, uint256 deadline) permit, bytes permitSignature, bytes intentSignature)',
    ),
    fn('cancelWithSig(uint256 subscriptionId, uint256 deadline, bytes signature)'),
    fn(
      'registerMerchant(address wallet, address payoutAddress, uint16 feeBps, uint16 maxFeeBps, uint256 tier)',
    ),
    fn('permit(address owner, address spender, uint256 value, uint256 deadline, bytes signature)'),
  ],
  scheduler: [
    fn('batchCharge(uint256[] subscriptionIds, bytes32[] chargeAttemptIds)'),
    fn('cancel(uint256 subscriptionId)'),
    fn('commitFeeBps(uint256 merchantId)'),
    fn('setFeeBps(uint256 merchantId, uint16 feeBps)'),
  ],
  refund: [fn('transfer(address to, uint256 amount)')],
} as const

export const safeExecFunction = fn(
  'execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)',
)

// gasPrice 0 means the Safe never refunds the relayer; the owners' signatures cover the rest.
export function safeExecRule(safe: Address) {
  return allowCall('Safe: execute owner-approved transaction', safe, safeExecFunction, [
    {
      field_source: 'ethereum_calldata',
      field: 'execTransaction.gasPrice',
      abi: [safeExecFunction],
      operator: 'eq',
      value: '0',
    },
  ])
}

/** The most one business is ever refunded: 0.5% of $1,000, in 6-decimal base units. */
export const REFUND_TRANSFER_CAP = 5_000_000n

function allowCall(name: string, to: Address, abi: AbiFunction, extra: object[] = []) {
  return {
    name,
    method: 'eth_signTransaction',
    action: 'ALLOW',
    conditions: [
      { field_source: 'ethereum_transaction', field: 'to', operator: 'eq', value: to },
      { field_source: 'ethereum_transaction', field: 'value', operator: 'eq', value: '0x0' },
      {
        field_source: 'ethereum_calldata',
        field: 'function_name',
        abi: [abi],
        operator: 'eq',
        value: abi.name,
      },
      ...extra,
    ],
  }
}

const policy = (name: string, rules: object[]) => ({
  version: '1.0' as const,
  name,
  chain_type: 'ethereum' as const,
  rules,
})

/**
 * Deny by default: Privy refuses any method or call these rules don't list
 * (ADR-2026-11-22-privy-server-signers).
 */
export function strimzSignerPolicies(c: StrimzContracts) {
  const [pay, subscribe, cancelWithSig, register, permit] = signerFunctions.relayer
  const [charge, cancel, commitFee, setFee] = signerFunctions.scheduler
  const [transfer] = signerFunctions.refund
  const capped = {
    field_source: 'ethereum_calldata',
    field: 'transfer.amount',
    abi: [transfer],
    operator: 'lte',
    value: REFUND_TRANSFER_CAP.toString(),
  }
  return {
    relayer: policy('strimz-mainnet-relayer', [
      allowCall('Payments: pay', c.payments, pay),
      allowCall('Subscriptions: subscribe', c.subscriptions, subscribe),
      allowCall('Subscriptions: payer cancel', c.subscriptions, cancelWithSig),
      allowCall('Registry: register merchant', c.registry, register),
      allowCall('USDC: renew allowance', c.usdc, permit),
      safeExecRule(c.safe),
    ]),
    scheduler: policy('strimz-mainnet-scheduler', [
      allowCall('Subscriptions: charge', c.subscriptions, charge),
      allowCall('Subscriptions: cancel', c.subscriptions, cancel),
      allowCall('Registry: commit fee', c.registry, commitFee),
      allowCall('Registry: set fee', c.registry, setFee),
    ]),
    refund: policy('strimz-mainnet-refund', [
      allowCall('USDC: refund fee', c.usdc, transfer, [capped]),
      allowCall('EURC: refund fee', c.eurc, transfer, [capped]),
    ]),
  }
}
