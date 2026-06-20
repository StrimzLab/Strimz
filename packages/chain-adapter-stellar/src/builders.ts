/**
 * Soroban transaction builders for the StrimzPayments + StrimzSubscription
 * invocations. Pure construction — these don't touch the network.
 *
 * The general shape:
 *
 *   1. Resolve the payer's account (fresh sequence via the RPC client).
 *   2. Build a `Contract.call(method, ...args)` operation against the
 *      target StrimzPayments / StrimzSubscription contract id.
 *   3. Wrap in a `TransactionBuilder` with the network passphrase + a
 *      base fee (the actual fee gets re-computed during simulation).
 *   4. Simulate via `rpc.simulateTransaction` to populate auth entries
 *      + Soroban resource fees.
 *   5. `assembleTransaction` produces a sign-ready transaction; the
 *      caller serialises to XDR for the wallet.
 *
 * The builders are deliberately split from the adapter itself so the
 * unit tests can exercise pure construction without an adapter
 * instance.
 */

import {
  BASE_FEE,
  Contract,
  TransactionBuilder,
  rpc,
  type Account,
  type Transaction,
} from '@stellar/stellar-sdk'

import { NETWORK_PASSPHRASE, type StellarNetwork } from './network.js'
import type { StellarRpcClient } from './rpc.js'
import {
  addressToScVal,
  bytesN32ToScVal,
  i128ToScVal,
  optionalU64ToScVal,
  refToBytesN32,
  u32ToScVal,
  u64ToScVal,
} from './scvals.js'

/**
 * Default transaction timeout. 30 seconds matches the upper bound on
 * Soroban's submission window after which the assembled tx becomes
 * stale; the frontend's wallet UX should complete signing well inside
 * this. The relayer (M5c) bumps if the wallet returns close to expiry.
 */
const TX_TIMEOUT_SECONDS = 30

export interface BuildPaymentInvocationInput {
  /** StrimzPayments contract id. */
  paymentsContract: string
  payerAddress: string
  merchantAddress: string
  assetAddress: string
  amount: string
  feeBps: number
  /** Free-form ref; hashed to BytesN<32> inside. */
  ref: string
  network: StellarNetwork
}

export interface BuildEnrolmentInvocationInput {
  /** StrimzSubscription contract id. */
  subscriptionContract: string
  payerAddress: string
  merchantAddress: string
  assetAddress: string
  amountPerPeriod: string
  periodSeconds: number
  feeBps: number
  endAt: number | null
  network: StellarNetwork
}

export interface BuiltTransaction {
  /** Raw pre-simulation transaction — pass to `assembleTransaction`. */
  tx: Transaction
  /** Hex-encoded 32-byte ref-id used in the call. Surfaced so the
   *  envelope can include it without re-hashing. */
  refIdHex: string
}

/**
 * Builds the pre-simulation transaction for a one-shot payment.
 */
export function buildPaymentInvocation(
  input: BuildPaymentInvocationInput,
  account: Account,
): BuiltTransaction {
  const refId = refToBytesN32(input.ref)
  const contract = new Contract(input.paymentsContract)
  const op = contract.call(
    'pay',
    addressToScVal(input.payerAddress),
    addressToScVal(input.merchantAddress),
    addressToScVal(input.assetAddress),
    i128ToScVal(input.amount),
    u32ToScVal(input.feeBps),
    bytesN32ToScVal(refId),
  )
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE[input.network],
  })
    .addOperation(op)
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build()
  return { tx, refIdHex: refId.toString('hex') }
}

/**
 * Builds the pre-simulation transaction for a subscription enrolment.
 */
export function buildEnrolmentInvocation(
  input: BuildEnrolmentInvocationInput,
  account: Account,
): BuiltTransaction {
  const contract = new Contract(input.subscriptionContract)
  const op = contract.call(
    'enrol',
    addressToScVal(input.payerAddress),
    addressToScVal(input.merchantAddress),
    addressToScVal(input.assetAddress),
    i128ToScVal(input.amountPerPeriod),
    u64ToScVal(input.periodSeconds),
    u32ToScVal(input.feeBps),
    optionalU64ToScVal(input.endAt),
  )
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE[input.network],
  })
    .addOperation(op)
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build()
  // Enrolment doesn't have an on-chain idempotency key (the contract
  // assigns a monotonic subscription_id on its own). We surface an
  // empty string to keep the BuiltTransaction shape uniform with
  // payment builds.
  return { tx, refIdHex: '' }
}

/**
 * Simulates the transaction against Soroban RPC and returns the
 * assembled sign-ready transaction. Throws on simulation error so the
 * adapter can surface a structured `chain_simulation_failed` to the
 * caller — never let a transaction with an empty / error simulation
 * leak into the signing path.
 */
export async function assembleViaSimulation(
  tx: Transaction,
  rpcClient: StellarRpcClient,
): Promise<Transaction> {
  const sim = await rpcClient.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`stellar simulation failed: ${sim.error}`)
  }
  return rpc.assembleTransaction(tx, sim).build()
}
